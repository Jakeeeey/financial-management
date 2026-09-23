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
  getPlanSubmission,
  getPlanRemaining,
  markWerPlanLiquidatedIfSettled,
  resolveDriverSupplier,
  withPlanLock,
  type DraftSubmission,
} from "../logistics-wer/_payables";

const TRANSACTION_TYPE: DisbursementTransactionType = 1;

export type WerApprovalDecision = "approve" | "return" | "reject";

export interface DecisionOutcome {
  submission: DraftSubmission;
  disbursementId: number | null;
  idempotent: boolean;
}

/** Thrown for expected per-submission failures; the caller maps it to a response. */
export class DecisionFailure extends Error {
  readonly status: number;
  readonly extra?: Record<string, unknown>;

  constructor(message: string, status: number, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function manilaDateOnly(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

async function loadSubmission(submissionId: number): Promise<{ planId: number; submission: DraftSubmission | null }> {
  return await getPlanSubmission(submissionId) ?? { planId: 0, submission: null };
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
      status: "approved",
      disbursement_id: created.disbursementId,
      decided_by: approverId,
      decided_at: now,
    });
    return { disbursementId: created.disbursementId, idempotent: false };
  } finally {
    releaseDocLock();
  }
}

export interface DecideOneInput {
  submissionId: number;
  decision: WerApprovalDecision;
  remarks: string;
  approverId: number;
}

/**
 * Decide a single submission. Shares one code path between the single and
 * bulk endpoints so batch approvals cannot drift from single approvals.
 */
export async function decideOneSubmission(input: DecideOneInput): Promise<DecisionOutcome> {
  const { submissionId, decision, remarks, approverId } = input;
  const initial = await loadSubmission(submissionId);
  if (!initial.submission || !initial.planId) {
    throw new DecisionFailure("Submission not found.", 404);
  }

  return withPlanLock(initial.planId, async () => {
    const reloaded = await loadSubmission(submissionId);
    const submission = reloaded.submission;
    if (!submission) throw new DecisionFailure("Submission not found.", 404);
    const status = (submission.status || "").toLowerCase();

    if (status === "approved") {
      return { submission, disbursementId: submission.disbursementId, idempotent: true };
    }
    if (status !== "submitted") {
      throw new DecisionFailure(
        `Only submitted payables can be decided (current: ${submission.status || "unknown"}).`,
        409,
      );
    }

    const now = new Date().toISOString();
    if (decision === "return" || decision === "reject") {
      await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
        status: decision === "return" ? "returned" : "rejected",
        decided_by: approverId,
        decided_at: now,
        decision_remarks: remarks,
      });
      await markWerPlanLiquidatedIfSettled(submission.id).catch((syncError) => {
        console.error("[Logistics WER] Liquidation sync after decision failed:", syncError);
      });
      const updated = (await loadSubmission(submissionId)).submission;
      if (!updated) throw new DecisionFailure("Submission not found.", 404);
      return { submission: updated, disbursementId: null, idempotent: false };
    }

    const baseline = await getPlanBaseline(initial.planId);
    if (!baseline) throw new DecisionFailure("Dispatch plan not found.", 404);
    if ((baseline.status || "").toLowerCase() !== "for clearance") {
      throw new DecisionFailure("The dispatch plan is no longer in For Clearance state; approval is blocked.", 409);
    }
    const eligibility = await resolveDriverSupplier(baseline.driverId);
    if (!eligibility.eligible || !eligibility.supplierId) {
      throw new DecisionFailure(
        eligibility.reason || "The assigned driver has no eligible supplier account.",
        422,
        { eligibility },
      );
    }
    const remaining = await getPlanRemaining(initial.planId);
    const otherReservations = remaining.reserved - submission.totalAmount;
    if (submission.totalAmount - (remaining.baseline - otherReservations) > 1e-6) {
      throw new DecisionFailure("The submission no longer fits the remaining payable amount.", 409, {
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
    const updated = (await loadSubmission(submissionId)).submission;
    if (!updated) throw new DecisionFailure("Submission not found.", 404);
    return { submission: updated, disbursementId, idempotent };
  });
}
