import { NextRequest, NextResponse } from "next/server";
import {
  DRAFT_COLLECTION,
  DRAFT_LINE_COLLECTION,
  DRAFT_RECEIPT_COLLECTION,
  directusFetch,
  directusWrite,
  getPlanBaseline,
  getPlanDrafts,
  getPlanRemaining,
  requireSessionUserId,
  resolveDriverSupplier,
  withPlanLock,
  type DraftSubmission,
} from "../../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PayableLineInput {
  amount?: unknown;
  referenceNo?: unknown;
  remarks?: unknown;
  date?: unknown;
  coaId?: unknown;
  receiptFileIds?: unknown;
}

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

interface ValidatedLine {
  amount: number;
  referenceNo: string | null;
  remarks: string | null;
  date: string | null;
  coaId: number | null;
  receiptFileIds: string[];
}

function validateLines(rawLines: unknown, requireCoa: boolean): ValidatedLine[] | { error: string } {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "At least one payable line is required." };
  }
  const lines: ValidatedLine[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = (rawLines[index] ?? {}) as PayableLineInput;
    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: `Line ${index + 1} must have an amount greater than zero.` };
    }
    const date = asTrimmedString(raw.date);
    if (date && !isValidDateOnly(date)) {
      return { error: `Line ${index + 1} must use a valid YYYY-MM-DD date.` };
    }
    const coaRaw = raw.coaId;
    const coaId = coaRaw === null || coaRaw === undefined || coaRaw === "" ? null : Number(coaRaw);
    if (requireCoa && (coaId === null || !Number.isInteger(coaId) || coaId <= 0)) {
      return { error: `Line ${index + 1} requires a valid chart-of-accounts entry before submission.` };
    }
    if (coaId !== null && (!Number.isInteger(coaId) || coaId <= 0)) {
      return { error: `Line ${index + 1} has an invalid chart-of-accounts entry.` };
    }
    const receiptRaw = raw.receiptFileIds;
    const receiptFileIds = receiptRaw === undefined || receiptRaw === null
      ? []
      : (Array.isArray(receiptRaw) ? receiptRaw : [receiptRaw]).map(asTrimmedString).filter(Boolean);
    lines.push({
      amount,
      referenceNo: asTrimmedString(raw.referenceNo) || null,
      remarks: asTrimmedString(raw.remarks) || null,
      date: date || null,
      coaId,
      receiptFileIds: Array.from(new Set(receiptFileIds)),
    });
  }
  return lines;
}

async function assertReceiptsAttachable(fileIds: string[], excludeDraftId: number | null): Promise<string | null> {
  for (const fileId of fileIds) {
    try {
      await directusFetch(`/files/${encodeURIComponent(fileId)}?fields=id`);
    } catch {
      return `Receipt ${fileId} does not exist.`;
    }
    const params = new URLSearchParams({
      "filter[file_id][_eq]": fileId,
      fields: "id,line_id",
      limit: "-1",
    });
    const existing = await directusFetch<{ data?: Array<{ id?: unknown; line_id?: unknown }> }>(
      `/items/${DRAFT_RECEIPT_COLLECTION}?${params.toString()}`,
    );
    for (const row of existing.data ?? []) {
      const lineParams = new URLSearchParams({
        "filter[id][_eq]": String(Number(row.line_id) || 0),
        fields: "id,draft_id",
        limit: "1",
      });
      const line = await directusFetch<{ data?: Array<{ id?: unknown; draft_id?: unknown }> }>(
        `/items/${DRAFT_LINE_COLLECTION}?${lineParams.toString()}`,
      );
      const ownerDraftId = Number(line.data?.[0]?.draft_id) || 0;
      if (!ownerDraftId || ownerDraftId === excludeDraftId) continue;
      const draftParams = new URLSearchParams({
        "filter[id][_eq]": String(ownerDraftId),
        fields: "id,status",
        limit: "1",
      });
      const draft = await directusFetch<{ data?: Array<{ status?: unknown }> }>(
        `/items/${DRAFT_COLLECTION}?${draftParams.toString()}`,
      );
      const status = String(draft.data?.[0]?.status || "").toLowerCase();
      if (status === "submitted" || status === "approved") {
        return `Receipt ${fileId} is already attached to an active payable submission.`;
      }
    }
  }
  return null;
}

async function findDraftByKey(planId: number, key: string) {
  const params = new URLSearchParams({
    "filter[dispatch_plan_id][_eq]": String(planId),
    "filter[idempotency_key][_eq]": key,
    fields: "id",
    limit: "1",
  });
  const result = await directusFetch<{ data?: Array<{ id?: unknown }> }>(
    `/items/${DRAFT_COLLECTION}?${params.toString()}`,
  );
  const id = Number(result.data?.[0]?.id) || 0;
  return id > 0 ? id : null;
}

async function loadSubmission(planId: number, draftId: number): Promise<DraftSubmission | null> {
  const submissions = await getPlanDrafts(planId);
  return submissions.find((submission) => submission.id === draftId) ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const planId = Number(dispatchPlanId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return error("dispatchPlanId must be a positive integer.", 400);
  }

  const userId = await requireSessionUserId(request);
  if (!userId) {
    return error("Authentication is required to record payables.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Request body must be valid JSON.", 400);
  }
  const action = asTrimmedString(body.action).toLowerCase();
  if (action !== "save-draft" && action !== "submit" && action !== "withdraw") {
    return error('action must be one of "save-draft", "submit", or "withdraw".', 400);
  }

  try {
    return await withPlanLock(planId, async () => {
      const baseline = await getPlanBaseline(planId);
      if (!baseline) return error("Dispatch plan not found.", 404);

      if (action === "withdraw") {
        const submissionId = Number(body.submissionId) || 0;
        if (!submissionId) return error("submissionId is required to withdraw a submission.", 400);
        const submission = await loadSubmission(planId, submissionId);
        if (!submission) return error("Submission not found for this dispatch plan.", 404);
        if ((submission.status || "").toLowerCase() !== "submitted") {
          return error("Only submitted payables can be withdrawn.", 409);
        }
        if (submission.submittedBy !== userId) {
          return error("Only the submitter can withdraw this submission.", 403);
        }
        await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, { status: "withdrawn" });
        const updated = await loadSubmission(planId, submission.id);
        return NextResponse.json({ draft: updated });
      }

      const planStatus = (baseline.status || "").toLowerCase();
      if (planStatus === "posted") {
        return error("Posted dispatch plans are read-only for new payable submissions.", 409);
      }
      if (baseline.isLiquidated) {
        return error("Liquidated dispatch plans are read-only for new payable submissions.", 409);
      }
      if (planStatus !== "for clearance") {
        return error(`Payables can only be recorded for plans in For Clearance state (current: ${baseline.status || "unknown"}).`, 409);
      }

      const idempotencyKey = asTrimmedString(body.idempotencyKey) || null;
      if (idempotencyKey) {
        const existingId = await findDraftByKey(planId, idempotencyKey);
        if (existingId) {
          const existing = await loadSubmission(planId, existingId);
          return NextResponse.json({ draft: existing, idempotent: true });
        }
      }

      const linesOrError = validateLines(body.lines, action === "submit");
      if (!Array.isArray(linesOrError)) return error(linesOrError.error, 400);
      const lines = linesOrError;
      const total = lines.reduce((sum, line) => sum + line.amount, 0);

      const eligibility = await resolveDriverSupplier(baseline.driverId);
      if (!eligibility.eligible) {
        return error(eligibility.reason || "The assigned driver has no eligible supplier account.", 422, {
          eligibility,
        });
      }

      if (action === "submit") {
        const remaining = await getPlanRemaining(planId);
        if (total - remaining.remaining > 1e-6) {
          return error(
            `Submitted total ${total} exceeds the remaining payable amount ${remaining.remaining}.`,
            409,
            { remaining: remaining.remaining },
          );
        }
      }

      const now = new Date().toISOString();
      const receiptCheck = await assertReceiptsAttachable(
        lines.flatMap((line) => line.receiptFileIds),
        null,
      );
      if (receiptCheck) return error(receiptCheck, 409);

      const created = await directusWrite<{ data?: { id?: unknown } }>("POST", `/items/${DRAFT_COLLECTION}`, {
        dispatch_plan_id: planId,
        status: action === "submit" ? "submitted" : "draft",
        total_amount: total,
        submitted_by: userId,
        submitted_at: action === "submit" ? now : null,
        idempotency_key: idempotencyKey,
        date_created: now,
        date_updated: now,
      });
      const draftId = Number(created.data?.id) || 0;
      if (!draftId) throw new Error("Draft creation did not return an id.");

      try {
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const createdLine = await directusWrite<{ data?: { id?: unknown } }>(
            "POST",
            `/items/${DRAFT_LINE_COLLECTION}`,
            {
              draft_id: draftId,
              line_no: index + 1,
              amount: line.amount,
              reference_no: line.referenceNo,
              remarks: line.remarks,
              date: line.date,
              coa_id: line.coaId,
              date_created: now,
            },
          );
          const lineId = Number(createdLine.data?.id) || 0;
          if (!lineId) throw new Error(`Line ${index + 1} creation did not return an id.`);
          for (const fileId of line.receiptFileIds) {
            await directusWrite("POST", `/items/${DRAFT_RECEIPT_COLLECTION}`, {
              line_id: lineId,
              file_id: fileId,
              uploaded_by: userId,
              date_created: now,
            });
          }
        }
      } catch (lineError) {
        // Compensating cleanup: a partial draft must not linger.
        const saved = await loadSubmission(planId, draftId).catch(() => null);
        for (const savedLine of saved?.lines ?? []) {
          for (const receipt of savedLine.receipts) {
            await directusWrite("DELETE", `/items/${DRAFT_RECEIPT_COLLECTION}/${receipt.id}`).catch(() => null);
          }
          await directusWrite("DELETE", `/items/${DRAFT_LINE_COLLECTION}/${savedLine.id}`).catch(() => null);
        }
        await directusWrite("DELETE", `/items/${DRAFT_COLLECTION}/${draftId}`).catch(() => null);
        throw lineError;
      }

      const draft = await loadSubmission(planId, draftId);
      return NextResponse.json({ draft }, { status: 201 });
    });
  } catch (requestError) {
    console.error("[Logistics WER] Payables request failed:", requestError);
    return error(requestError instanceof Error ? requestError.message : "Unable to record the payable.", 502);
  }
}
