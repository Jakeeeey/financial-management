import { NextRequest, NextResponse } from "next/server";
import {
  DRAFT_COLLECTION,
  DRAFT_LINE_COLLECTION,
  DRAFT_RECEIPT_COLLECTION,
  BudgetContextError,
  directusFetch,
  directusWrite,
  getPlanBaseline,
  getPlanSubmission,
  getPlanRemaining,
  markWerPlanLiquidatedIfSettled,
  requireSessionUserId,
  resolveDriverSupplier,
  withPlanLock,
  type DraftSubmission,
} from "../../_payables";
import { findBudgetRequestOverages } from "@/modules/financial-management/reports/logistics-wer/utils/budget-balances";
import { validatePayableLines } from "@/modules/financial-management/reports/logistics-wer/utils/payable-validation";
import type { ValidatedPayableLine } from "@/modules/financial-management/reports/logistics-wer/utils/payable-validation";
import { formatManilaWallClock } from "../../_timestamps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  const record = await getPlanSubmission(draftId);
  return record?.planId === planId ? record.submission : null;
}

async function deleteSubmissionLines(draftId: number, lineIds?: number[]): Promise<void> {
  let ids = lineIds;
  if (!ids) {
    const params = new URLSearchParams({
      "filter[draft_id][_eq]": String(draftId),
      fields: "id",
      limit: "-1",
    });
    const result = await directusFetch<{ data?: Array<{ id?: unknown }> }>(
      `/items/${DRAFT_LINE_COLLECTION}?${params.toString()}`,
    );
    ids = (result.data ?? []).map((row) => Number(row.id)).filter((id) => id > 0);
  }
  if (ids.length === 0) return;

  const receiptParams = new URLSearchParams({
    "filter[line_id][_in]": ids.join(","),
    fields: "id",
    limit: "-1",
  });
  const receipts = await directusFetch<{ data?: Array<{ id?: unknown }> }>(
    `/items/${DRAFT_RECEIPT_COLLECTION}?${receiptParams.toString()}`,
  );
  for (const receipt of receipts.data ?? []) {
    const id = Number(receipt.id) || 0;
    if (id) await directusWrite("DELETE", `/items/${DRAFT_RECEIPT_COLLECTION}/${id}`);
  }
  for (const id of ids) {
    await directusWrite("DELETE", `/items/${DRAFT_LINE_COLLECTION}/${id}`);
  }
}

async function createSubmissionLines(
  draftId: number,
  lines: ValidatedPayableLine[],
  userId: number,
  now: string,
): Promise<number[]> {
  const createdLineIds: number[] = [];
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
      createdLineIds.push(lineId);
      for (const fileId of line.receiptFileIds) {
        await directusWrite("POST", `/items/${DRAFT_RECEIPT_COLLECTION}`, {
          line_id: lineId,
          file_id: fileId,
          uploaded_by: userId,
          date_created: now,
        });
      }
    }
    return createdLineIds;
  } catch (lineError) {
    await deleteSubmissionLines(draftId, createdLineIds).catch((cleanupError) => {
      console.error("[Logistics WER] Replacement line cleanup failed:", cleanupError);
    });
    throw lineError;
  }
}

async function removeUnattachedReceiptFiles(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    const params = new URLSearchParams({
      "filter[file_id][_eq]": fileId,
      fields: "id",
      limit: "1",
    });
    const linked = await directusFetch<{ data?: Array<{ id?: unknown }> }>(
      `/items/${DRAFT_RECEIPT_COLLECTION}?${params.toString()}`,
    );
    if ((linked.data ?? []).length > 0) continue;
    const response = await fetch(`${DIRECTUS_URL}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Unable to remove receipt ${fileId}.`);
    }
  }
}

async function replaceReturnedSubmissionLines(
  submission: DraftSubmission,
  lines: ValidatedPayableLine[],
  userId: number,
  now: string,
  action: "save-draft" | "submit",
  total: number,
): Promise<void> {
  const existingById = new Map(submission.lines.map((line) => [line.id, line]));
  const existingIds = new Set(existingById.keys());
  const requestedIds = lines.flatMap((line) => line.id === undefined ? [] : [line.id]);
  if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existingIds.has(id))) {
    throw new Error("One or more payable lines do not belong to this returned submission.");
  }

  const existingReceiptLineIds = new Map<string, number>();
  for (const line of submission.lines) {
    for (const receipt of line.receipts) {
      if (receipt.fileId) existingReceiptLineIds.set(receipt.fileId, line.id);
    }
  }
  const requestedFileIds = lines.flatMap((line) => line.receiptFileIds);
  if (new Set(requestedFileIds).size !== requestedFileIds.length) {
    throw new Error("A receipt can only be attached to one payable line.");
  }
  for (const line of lines) {
    for (const fileId of line.receiptFileIds) {
      const originalLineId = existingReceiptLineIds.get(fileId);
      if (originalLineId !== undefined && originalLineId !== line.id) {
        throw new Error("An existing receipt must remain on its original payable line.");
      }
    }
  }

  const targetFileIds = new Set(lines.flatMap((line) => line.receiptFileIds));
  const removedFileIds = Array.from(new Set(
    submission.lines.flatMap((line) => line.receipts.map((receipt) => receipt.fileId).filter((id): id is string => Boolean(id))),
  )).filter((fileId) => !targetFileIds.has(fileId));

  const createdLineIds: number[] = [];
  const createdReceiptIds: number[] = [];
  let hasMutations = false;
  try {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      let lineId = line.id ?? 0;
      if (lineId) {
        hasMutations = true;
        await directusWrite("PATCH", `/items/${DRAFT_LINE_COLLECTION}/${lineId}`, {
          line_no: index + 1,
          amount: line.amount,
          reference_no: line.referenceNo,
          remarks: line.remarks,
          date: line.date,
          coa_id: line.coaId,
        });
      } else {
        hasMutations = true;
        const created = await directusWrite<{ data?: { id?: unknown } }>("POST", `/items/${DRAFT_LINE_COLLECTION}`, {
          draft_id: submission.id,
          line_no: index + 1,
          amount: line.amount,
          reference_no: line.referenceNo,
          remarks: line.remarks,
          date: line.date,
          coa_id: line.coaId,
          date_created: now,
        });
        lineId = Number(created.data?.id) || 0;
        if (!lineId) throw new Error(`Line ${index + 1} creation did not return an id.`);
        createdLineIds.push(lineId);
      }

      const originalLine = line.id === undefined ? null : existingById.get(line.id) ?? null;
      const existingFileIds = new Set(originalLine?.receipts.map((receipt) => receipt.fileId).filter((id): id is string => Boolean(id)) ?? []);
      for (const fileId of line.receiptFileIds) {
        if (existingFileIds.has(fileId)) continue;
        hasMutations = true;
        const receipt = await directusWrite<{ data?: { id?: unknown } }>("POST", `/items/${DRAFT_RECEIPT_COLLECTION}`, {
          line_id: lineId,
          file_id: fileId,
          uploaded_by: userId,
          date_created: now,
        });
        const receiptId = Number(receipt.data?.id) || 0;
        if (!receiptId) throw new Error(`Receipt attachment for line ${index + 1} did not return an id.`);
        createdReceiptIds.push(receiptId);
      }
    }

    const retainedLineIds = new Set(requestedIds);
    const removedReceiptIds = submission.lines
      .filter((line) => retainedLineIds.has(line.id))
      .flatMap((line) => line.receipts
        .filter((receipt) => !lines.find((requested) => requested.id === line.id)?.receiptFileIds.includes(receipt.fileId || ""))
        .map((receipt) => receipt.id));
    for (const receiptId of removedReceiptIds) {
      hasMutations = true;
      await directusWrite("DELETE", `/items/${DRAFT_RECEIPT_COLLECTION}/${receiptId}`);
    }
    const removedLineIds = submission.lines.filter((line) => !retainedLineIds.has(line.id)).map((line) => line.id);
    if (removedLineIds.length > 0) hasMutations = true;
    await deleteSubmissionLines(submission.id, removedLineIds);

    hasMutations = true;
    await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
      status: action === "submit" ? "submitted" : "returned",
      total_amount: total,
      ...(action === "submit" ? { submitted_at: new Date().toISOString() } : {}),
      date_updated: formatManilaWallClock(),
    });
  } catch (replaceError) {
    if (hasMutations) {
      try {
        await deleteSubmissionLines(submission.id);
        const originalLines = submission.lines.map((line) => ({
          id: line.id,
          amount: line.amount,
          referenceNo: line.referenceNo,
          remarks: line.remarks,
          date: line.date,
          coaId: line.coaId,
          receiptFileIds: line.receipts.map((receipt) => receipt.fileId).filter((id): id is string => Boolean(id)),
        }));
        await createSubmissionLines(submission.id, originalLines, userId, now);
        await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
          status: "returned",
          total_amount: submission.totalAmount,
          submitted_at: submission.submittedAt,
          date_updated: formatManilaWallClock(),
        });
      } catch (rollbackError) {
        console.error("[Logistics WER] Returned payable line rollback failed:", rollbackError);
      }
    }
    for (const receiptId of createdReceiptIds) {
      await directusWrite("DELETE", `/items/${DRAFT_RECEIPT_COLLECTION}/${receiptId}`).catch(() => null);
    }
    for (const lineId of createdLineIds) {
      await directusWrite("DELETE", `/items/${DRAFT_LINE_COLLECTION}/${lineId}`).catch(() => null);
    }
    throw replaceError;
  }
  await removeUnattachedReceiptFiles(removedFileIds).catch((cleanupError) => {
    console.error("[Logistics WER] Removed receipt cleanup failed:", cleanupError);
  });
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
  const hasSubmissionId = body.submissionId !== undefined && body.submissionId !== null && body.submissionId !== "";
  const requestedSubmissionId = hasSubmissionId ? Number(body.submissionId) : null;
  if (hasSubmissionId && (!Number.isInteger(requestedSubmissionId) || Number(requestedSubmissionId) <= 0)) {
    return error("submissionId must be a positive integer.", 400);
  }

  try {
    return await withPlanLock(planId, async () => {
      const baseline = await getPlanBaseline(planId);
      if (!baseline) return error("Dispatch plan not found.", 404);

      if (action === "withdraw") {
        const submissionId = requestedSubmissionId || 0;
        if (!submissionId) return error("submissionId is required to withdraw a submission.", 400);
        const submission = await loadSubmission(planId, submissionId);
        if (!submission) return error("Submission not found for this dispatch plan.", 404);
        if ((submission.status || "").toLowerCase() !== "submitted") {
          return error("Only submitted payables can be withdrawn.", 409);
        }
        if (submission.submittedBy !== userId) {
          return error("Only the submitter can withdraw this submission.", 403);
        }
        await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
          status: "withdrawn",
          date_updated: formatManilaWallClock(),
        });
        await markWerPlanLiquidatedIfSettled(submission.id).catch((syncError) => {
          console.error("[Logistics WER] Liquidation sync after withdrawal failed:", syncError);
        });
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

      if (requestedSubmissionId) {
        if (action !== "save-draft" && action !== "submit") {
          return error("Returned submissions can only be saved or resubmitted.", 400);
        }
        const submission = await loadSubmission(planId, requestedSubmissionId);
        if (!submission) return error("Submission not found for this dispatch plan.", 404);
        if ((submission.status || "").toLowerCase() !== "returned" || submission.disbursementId !== null) {
          return error("Only returned, unconverted payables can be edited.", 409);
        }
        if (submission.submittedBy !== userId) {
          return error("Only the original submitter can edit this returned payable.", 403);
        }

        const validation = validatePayableLines(body.lines, action === "submit");
        if (!validation.valid) return error(validation.error, 400);
        const lines = validation.lines;
        const existingLineIds = new Set(submission.lines.map((line) => line.id));
        const requestedLineIds = lines.flatMap((line) => line.id === undefined ? [] : [line.id]);
        if (new Set(requestedLineIds).size !== requestedLineIds.length || requestedLineIds.some((id) => !existingLineIds.has(id))) {
          return error("One or more payable lines do not belong to this returned submission.", 400);
        }
        const existingReceiptLineIds = new Map<string, number>();
        for (const line of submission.lines) {
          for (const receipt of line.receipts) {
            if (receipt.fileId) existingReceiptLineIds.set(receipt.fileId, line.id);
          }
        }
        const requestedFileIds = lines.flatMap((line) => line.receiptFileIds);
        if (new Set(requestedFileIds).size !== requestedFileIds.length) {
          return error("A receipt can only be attached to one payable line.", 400);
        }
        if (lines.some((line) => line.receiptFileIds.some((fileId) => {
          const originalLineId = existingReceiptLineIds.get(fileId);
          return originalLineId !== undefined && originalLineId !== line.id;
        }))) {
          return error("An existing receipt must remain on its original payable line.", 400);
        }
        const total = lines.reduce((sum, line) => sum + line.amount, 0);
        const receiptCheck = await assertReceiptsAttachable(
          lines.flatMap((line) => line.receiptFileIds),
          submission.id,
        );
        if (receiptCheck) return error(receiptCheck, 409);

        if (action === "submit") {
          const eligibility = await resolveDriverSupplier(baseline.driverId);
          if (!eligibility.eligible) {
            return error(eligibility.reason || "The assigned driver has no eligible supplier account.", 422, {
              eligibility,
            });
          }
          const remaining = await getPlanRemaining(planId);
          if (remaining.unclassifiedReservedAmount > 0) {
            return error(
              "Existing active payable reservations include unclassified COA lines. Resolve those submissions before adding expense budget reservations.",
              409,
              { remaining: remaining.remaining },
            );
          }
          const overages = findBudgetRequestOverages(lines, remaining.budgetBalancesByCoa);
          if (overages.length > 0) {
            return error(
              "One or more payable lines exceed the remaining expense budget for their selected COA.",
              409,
              { remaining: remaining.remaining, overages },
            );
          }
        }

        const now = new Date().toISOString();
        await replaceReturnedSubmissionLines(submission, lines, userId, now, action, total);
        const updated = await loadSubmission(planId, submission.id);
        return NextResponse.json({ draft: updated });
      }

      const idempotencyKey = asTrimmedString(body.idempotencyKey) || null;
      if (idempotencyKey) {
        const existingId = await findDraftByKey(planId, idempotencyKey);
        if (existingId) {
          const existing = await loadSubmission(planId, existingId);
          return NextResponse.json({ draft: existing, idempotent: true });
        }
      }

      const validation = validatePayableLines(body.lines, action === "submit");
      if (!validation.valid) return error(validation.error, 400);
      const lines = validation.lines;
      if (lines.some((line) => line.id !== undefined)) {
        return error("Line identifiers can only be provided when editing a returned submission.", 400);
      }
      const total = lines.reduce((sum, line) => sum + line.amount, 0);

      const eligibility = await resolveDriverSupplier(baseline.driverId);
      if (!eligibility.eligible) {
        return error(eligibility.reason || "The assigned driver has no eligible supplier account.", 422, {
          eligibility,
        });
      }

      if (action === "submit") {
        const remaining = await getPlanRemaining(planId);
        if (remaining.unclassifiedReservedAmount > 0) {
          return error(
            "Existing active payable reservations include unclassified COA lines. Resolve those submissions before adding expense budget reservations.",
            409,
            { remaining: remaining.remaining },
          );
        }
        const overages = findBudgetRequestOverages(lines, remaining.budgetBalancesByCoa);
        if (overages.length > 0) {
          return error(
            "One or more payable lines exceed the remaining expense budget for their selected COA.",
            409,
            { remaining: remaining.remaining, overages },
          );
        }
      }

      const now = new Date().toISOString();
      const receiptCheck = await assertReceiptsAttachable(
        lines.flatMap((line) => line.receiptFileIds),
        null,
      );
      if (receiptCheck) return error(receiptCheck, 409);

      const auditNow = formatManilaWallClock();
      const created = await directusWrite<{ data?: { id?: unknown } }>("POST", `/items/${DRAFT_COLLECTION}`, {
        dispatch_plan_id: planId,
        status: action === "submit" ? "submitted" : "draft",
        total_amount: total,
        submitted_by: userId,
        submitted_at: action === "submit" ? now : null,
        idempotency_key: idempotencyKey,
        date_created: auditNow,
        date_updated: auditNow,
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
    if (requestError instanceof BudgetContextError) {
      return error(`Submission blocked because the expense budget could not be verified: ${requestError.message}`, 503);
    }
    return error(requestError instanceof Error ? requestError.message : "Unable to record the payable.", 502);
  }
}
