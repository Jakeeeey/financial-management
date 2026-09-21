import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  acquireDocumentNumberLock,
  findNextAvailableDocumentNumber,
  type DisbursementTransactionType,
} from "@/modules/financial-management/treasury/disbursement/document-number";
import {
  DRAFT_COLLECTION,
  directusFetch,
  directusWrite,
  getPlanBaseline,
  getPlanDrafts,
  getPlanRemaining,
  requireSessionUserId,
  resolveDriverSupplier,
  withPlanLock,
  type DraftSubmission,
} from "../../../logistics-wer/_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSACTION_TYPE: DisbursementTransactionType = 1;

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function manilaDateOnly(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

async function loadSubmission(submissionId: number): Promise<{ planId: number; submission: DraftSubmission | null }> {
  const header = await directusFetch<{ data?: Record<string, unknown> }>(
    `/items/${DRAFT_COLLECTION}/${submissionId}?fields=id,dispatch_plan_id`,
  ).catch(() => null);
  const planId = Number(header?.data?.dispatch_plan_id) || 0;
  if (!planId) return { planId: 0, submission: null };
  const submissions = await getPlanDrafts(planId);
  return { planId, submission: submissions.find((item) => item.id === submissionId) ?? null };
}

interface CreatedIds {
  disbursementId: number;
  payableIds: number[];
  attachmentIds: number[];
}

async function cleanupConversion(created: Partial<CreatedIds>): Promise<void> {
  for (const attachmentId of created.attachmentIds ?? []) {
    await directusWrite("DELETE", `/items/disbursement_attachment/${attachmentId}`).catch(() => null);
  }
  for (const payableId of created.payableIds ?? []) {
    await directusWrite("DELETE", `/items/disbursement_payables/${payableId}`).catch(() => null);
  }
  if (created.disbursementId) {
    await directusWrite("DELETE", `/items/disbursement/${created.disbursementId}`).catch(() => null);
  }
}

/**
 * Convert an approved submission into one standard Draft disbursement.
 * Retries reuse the existing disbursement instead of duplicating it.
 */
async function convertSubmission(
  planDocNo: string,
  submission: DraftSubmission,
  supplierId: number,
  approverId: number,
): Promise<{ disbursementId: number; idempotent: boolean }> {
  if (submission.disbursementId) {
    const existing = await directusFetch<{ data?: Record<string, unknown> }>(
      `/items/disbursement/${submission.disbursementId}?fields=id`,
    ).catch(() => null);
    if (existing?.data) return { disbursementId: submission.disbursementId, idempotent: true };
  }

  const created: CreatedIds = { disbursementId: 0, payableIds: [], attachmentIds: [] };
  const releaseDocLock = await acquireDocumentNumberLock(TRANSACTION_TYPE);
  try {
    const now = new Date().toISOString();
    const docNo = await findNextAvailableDocumentNumber(TRANSACTION_TYPE, directusFetch);
    const header = await directusWrite<{ data?: { id?: unknown } }>("POST", "/items/disbursement", {
      doc_no: docNo,
      transaction_type: TRANSACTION_TYPE,
      payee: supplierId,
      remarks: `Logistics WER ${planDocNo} payable (submission #${submission.id})`,
      total_amount: submission.totalAmount,
      paid_amount: 0,
      encoder_id: approverId,
      transaction_date: manilaDateOnly(),
      status: "Draft",
      source_type: "LOGISTICS_WER",
      source_reference_id: submission.id,
    });
    created.disbursementId = Number(header.data?.id) || 0;
    if (!created.disbursementId) throw new Error("Disbursement creation did not return an id.");

    try {
      for (const line of submission.lines) {
        const payable = await directusWrite<{ data?: { id?: unknown } }>("POST", "/items/disbursement_payables", {
          disbursement_id: created.disbursementId,
          reference_no: line.referenceNo,
          date: line.date,
          coa_id: line.coaId,
          amount: line.amount,
          remarks: line.remarks,
        });
        const payableId = Number(payable.data?.id) || 0;
        if (!payableId) throw new Error("Payable row creation did not return an id.");
        created.payableIds.push(payableId);

        for (const receipt of line.receipts) {
          if (!receipt.fileId) continue;
          const file = await directusFetch<{ data?: Record<string, unknown> }>(
            `/files/${encodeURIComponent(receipt.fileId)}?fields=id,filename_download,type,filesize`,
          ).catch(() => null);
          const fileData = file?.data ?? {};
          const attachment = await directusWrite<{ data?: { id?: unknown } }>("POST", "/items/disbursement_attachment", {
            disbursement_id: created.disbursementId,
            disbursement_payable_id: payableId,
            file_name: String(fileData.filename_download ?? receipt.fileId),
            file_url: `/assets/${receipt.fileId}`,
            file_type: String(fileData.type ?? "application/octet-stream"),
            file_size: Number(fileData.filesize) || 0,
            uploaded_by: approverId,
            date_created: now,
          });
          const attachmentId = Number(attachment.data?.id) || 0;
          if (!attachmentId) throw new Error("Attachment creation did not return an id.");
          created.attachmentIds.push(attachmentId);
        }
      }

      const verifyParams = new URLSearchParams({
        "filter[disbursement_id][_eq]": String(created.disbursementId),
        limit: "-1",
        fields: "amount",
      });
      const verify = await directusFetch<{ data?: Array<{ amount?: unknown }> }>(
        `/items/disbursement_payables?${verifyParams.toString()}`,
      );
      const persistedTotal = (verify.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      if (Math.abs(persistedTotal - submission.totalAmount) > 1e-6) {
        throw new Error("Converted payable rows do not match the submission total.");
      }
    } catch (conversionError) {
      await cleanupConversion(created);
      throw conversionError;
    }

    await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
      status: "converted",
      disbursement_id: created.disbursementId,
      decided_by: approverId,
      decided_at: now,
    });
    return { disbursementId: created.disbursementId, idempotent: false };
  } finally {
    releaseDocLock();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const id = Number(submissionId);
  if (!Number.isInteger(id) || id <= 0) {
    return error("submissionId must be a positive integer.", 400);
  }

  const approverId = await requireSessionUserId(request);
  if (!approverId) return error("Authentication is required to decide on a submission.", 401);
  if (!(await hasDisbursementApprovalAccess(approverId).catch(() => false))) {
    return error("Disbursement approval access is required to decide on a submission.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Request body must be valid JSON.", 400);
  }
  const decision = asTrimmedString(body.decision).toLowerCase();
  if (decision !== "approve" && decision !== "return" && decision !== "reject") {
    return error('decision must be one of "approve", "return", or "reject".', 400);
  }
  const remarks = asTrimmedString(body.remarks);
  if ((decision === "return" || decision === "reject") && !remarks) {
    return error("Decision remarks are required when returning or rejecting a submission.", 400);
  }

  try {
    const initial = await loadSubmission(id);
    if (!initial.submission || !initial.planId) return error("Submission not found.", 404);

    return await withPlanLock(initial.planId, async () => {
      const reloaded = await loadSubmission(id);
      const submission = reloaded.submission;
      if (!submission) return error("Submission not found.", 404);
      const status = (submission.status || "").toLowerCase();

      if (status === "converted") {
        return NextResponse.json({
          draft: submission,
          disbursementId: submission.disbursementId,
          idempotent: true,
        });
      }
      if (status !== "submitted") {
        return error(`Only submitted payables can be decided (current: ${submission.status || "unknown"}).`, 409);
      }

      const now = new Date().toISOString();
      if (decision === "return" || decision === "reject") {
        await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
          status: decision === "return" ? "returned" : "rejected",
          decided_by: approverId,
          decided_at: now,
          decision_remarks: remarks,
        });
        const updated = (await loadSubmission(id)).submission;
        return NextResponse.json({ draft: updated });
      }

      const baseline = await getPlanBaseline(initial.planId);
      if (!baseline) return error("Dispatch plan not found.", 404);
      if ((baseline.status || "").toLowerCase() !== "for clearance") {
        return error("The dispatch plan is no longer in For Clearance state; approval is blocked.", 409);
      }
      const eligibility = await resolveDriverSupplier(baseline.driverId);
      if (!eligibility.eligible || !eligibility.supplierId) {
        return error(eligibility.reason || "The assigned driver has no eligible supplier account.", 422, {
          eligibility,
        });
      }
      const remaining = await getPlanRemaining(initial.planId);
      const otherReservations = remaining.reserved - submission.totalAmount;
      if (submission.totalAmount - (remaining.baseline - otherReservations) > 1e-6) {
        return error("The submission no longer fits the remaining payable amount.", 409, {
          remaining: remaining.baseline - otherReservations,
        });
      }

      const { disbursementId, idempotent } = await convertSubmission(
        baseline.docNo,
        submission,
        eligibility.supplierId,
        approverId,
      );
      if (!idempotent && remarks) {
        await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
          decision_remarks: remarks,
        }).catch(() => null);
      }
      const updated = (await loadSubmission(id)).submission;
      return NextResponse.json({ draft: updated, disbursementId, idempotent });
    });
  } catch (decisionError) {
    console.error("[Logistics WER] Decision failed:", decisionError);
    return error(decisionError instanceof Error ? decisionError.message : "Unable to record the decision.", 502);
  }
}
