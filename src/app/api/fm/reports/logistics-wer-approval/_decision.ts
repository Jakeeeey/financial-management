import { publicWerFailure, WerDependencyError } from "../logistics-wer/_errors";
import { calculateExpenseVariance } from "@/modules/financial-management/reports/logistics-wer/utils/budget-balances";
import {
  acquireDocumentNumberLock,
  documentPrefixForTransactionType,
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
import { formatManilaWallClock } from "../logistics-wer/_timestamps";
import { hasCompletePayableOrganization } from "@/modules/financial-management/reports/logistics-wer/utils/payable-validation";
import {
  isValidLogisticsWerDisbursementHeader,
  LOGISTICS_WER_TRANSACTION_TYPE,
} from "./_transaction-type";

const TRANSACTION_TYPE: DisbursementTransactionType = LOGISTICS_WER_TRANSACTION_TYPE;

export type WerApprovalDecision = "approve" | "return" | "reject";

export interface DecisionOutcome {
  refreshFailure?: ReturnType<typeof publicWerFailure>;
  submission: DraftSubmission;
  disbursementId: number | null;
  disbursementDocNo: string | null;
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

async function getDisbursementDocNo(disbursementId: number): Promise<string | null> {
  const result = await directusFetch<{ data?: { doc_no?: unknown } }>(
    `/items/disbursement/${disbursementId}?fields=doc_no`,
  ).catch(() => null);
  return typeof result?.data?.doc_no === "string" ? result.data.doc_no.trim() || null : null;
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
  decisionRemarks: string,
): Promise<{ disbursementId: number; disbursementDocNo: string | null; idempotent: boolean }> {
  if (submission.disbursementId) {
    const existing = await directusFetch<{ data?: Record<string, unknown> }>(
      `/items/disbursement/${submission.disbursementId}?fields=id,doc_no`,
    ).catch(() => null);
    if (existing?.data) {
      const docNo = typeof existing.data.doc_no === "string" ? existing.data.doc_no.trim() || null : null;
      return { disbursementId: submission.disbursementId, disbursementDocNo: docNo, idempotent: true };
    }
  }

  const created: CreatedIds = { disbursementId: 0, payableIds: [], attachmentIds: [] };
  const releaseDocLock = await acquireDocumentNumberLock(TRANSACTION_TYPE);
  try {
    const now = new Date().toISOString();
    const werNow = formatManilaWallClock(new Date(now));
    const docNo = await findNextAvailableDocumentNumber(TRANSACTION_TYPE, directusFetch);
    const header = await directusWrite<{ data?: { id?: unknown; transaction_type?: unknown; doc_no?: unknown } }>("POST", "/items/disbursement", {
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
      department_id: submission.departmentId,
    });
    created.disbursementId = Number(header.data?.id) || 0;
    if (!created.disbursementId) throw new Error("Disbursement creation did not return an id.");

    try {
      if (!isValidLogisticsWerDisbursementHeader(header.data)) {
        const prefix = documentPrefixForTransactionType(TRANSACTION_TYPE);
        throw new Error(`Disbursement was created but its Non-Trade type or ${prefix}- document number was not persisted.`);
      }

      for (const line of submission.lines) {
        const payable = await directusWrite<{ data?: { id?: unknown } }>("POST", "/items/disbursement_payables", {
          disbursement_id: created.disbursementId,
          reference_no: line.referenceNo,
          date: line.date,
          coa_id: line.coaId,
          division_id: line.divisionId,
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

      await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
        status: "approved",
        decision_remarks: decisionRemarks,
        disbursement_id: created.disbursementId,
        decided_by: approverId,
        decided_at: werNow,
        date_updated: werNow,
      });
    } catch (conversionError) {
      await cleanupConversion(created);
      throw conversionError;
    }

    return { disbursementId: created.disbursementId, disbursementDocNo: docNo, idempotent: false };
  } finally {
    releaseDocLock();
  }
}

export interface DecideOneInput {
  submissionId: number;
  decision: WerApprovalDecision;
  remarks: string;
  approverId: number;
  acknowledgeVariance?: boolean;
}

/**
 * Decide a single submission. Shares one code path between the single and
 * bulk endpoints so batch approvals cannot drift from single approvals.
 */
export async function decideOneSubmission(input: DecideOneInput): Promise<DecisionOutcome> {
  const { submissionId, decision, remarks, approverId } = input;
  const initial = await loadSubmission(submissionId).catch((cause) => {
    if (cause instanceof WerDependencyError) cause.mutationOutcome = "not_applied";
    throw cause;
  });
  if (!initial.submission || !initial.planId) {
    throw new DecisionFailure("Submission not found.", 404);
  }

  let writeStarted = false;
  return withPlanLock(initial.planId, async () => {
    const reloaded = await loadSubmission(submissionId);
    const submission = reloaded.submission;
    if (!submission) throw new DecisionFailure("Submission not found.", 404);
    const status = (submission.status || "").toLowerCase();

    if (status === "approved") {
      const disbursementDocNo = submission.disbursementId
        ? await getDisbursementDocNo(submission.disbursementId)
        : null;
      return { submission, disbursementId: submission.disbursementId, disbursementDocNo, idempotent: true };
    }
    if (status !== "submitted") {
      throw new DecisionFailure(
        `Only submitted payables can be decided (current: ${submission.status || "unknown"}).`,
        409,
      );
    }

    const now = formatManilaWallClock();
    const auditNow = now;
    if (decision === "return" || decision === "reject") {
      writeStarted = true;
      await directusWrite("PATCH", `/items/${DRAFT_COLLECTION}/${submission.id}`, {
        status: decision === "return" ? "returned" : "rejected",
        decided_by: approverId,
        decided_at: now,
        decision_remarks: remarks,
        date_updated: auditNow,
      });
      await markWerPlanLiquidatedIfSettled(submission.id).catch((syncError) => {
        console.error("[Logistics WER] Liquidation sync after decision failed:", syncError);
      });
      let refreshFailure: ReturnType<typeof publicWerFailure> | undefined;
      const updated = await loadSubmission(submissionId).then(record => record.submission).catch((cause) => {
        refreshFailure = publicWerFailure(cause, "applied", submissionId);
        return null;
      });
      return { submission: updated ?? { ...submission, status: decision === "return" ? "returned" : "rejected", decidedBy: approverId, decidedAt: now, decisionRemarks: remarks }, disbursementId: null, disbursementDocNo: null, idempotent: false, refreshFailure };
    }

    if (!hasCompletePayableOrganization(submission.departmentId, submission.lines)) {
      throw new DecisionFailure(
        "This submission is missing a department or line division. Return it to the submitter to complete the organizational fields before approval.",
        422,
      );
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
    const variance = calculateExpenseVariance(submission.lines, remaining.budgetBalancesByCoa, remaining.allocatedBudget, remaining.reserved, submission.lines);
    if (variance.requiresAcknowledgment && (input.acknowledgeVariance !== true || !remarks.trim())) {
      throw new DecisionFailure("Review this submission individually and acknowledge the budget variance with a reason before approval.", 422, { variance });
    }
    const decisionRemarks = variance.requiresAcknowledgment
      ? `${remarks.trim()}\nBudget variance acknowledged. Allocation: PHP ${variance.allocatedAmount.toFixed(2)}; current actual: PHP ${variance.actualAmount.toFixed(2)}; other committed: PHP ${variance.otherCommittedAmount.toFixed(2)}; projected cumulative actual: PHP ${variance.projectedActualAmount.toFixed(2)}; net variance: PHP ${variance.netVariance.toFixed(2)}.\n${variance.byCoa.map((row) => `COA ${row.coaId}: allocated PHP ${row.allocatedAmount.toFixed(2)}, other committed PHP ${row.otherCommittedAmount.toFixed(2)}, current PHP ${row.requestedAmount.toFixed(2)}, projected PHP ${row.projectedAmount.toFixed(2)}, overage PHP ${row.overAmount.toFixed(2)}${row.unbudgeted ? " (Unbudgeted)" : ""}.`).join("\n")}`
      : remarks;
    writeStarted = true;
    const { disbursementId, disbursementDocNo, idempotent } = await convertSubmission(
      baseline.docNo,
      submission,
      eligibility.supplierId,
      approverId,
      decisionRemarks,
    );
    let refreshFailure: ReturnType<typeof publicWerFailure> | undefined;
    const updated = await loadSubmission(submissionId).then((record) => record.submission).catch((cause) => {
      refreshFailure = publicWerFailure(cause, "applied", submissionId);
      return null;
    });
    return {
      submission: updated ?? { ...submission, status: "approved", disbursementId, decidedBy: approverId, decidedAt: null, decisionRemarks },
      disbursementId, disbursementDocNo, idempotent, refreshFailure,
    };
  }).catch((cause) => {
    if (cause instanceof WerDependencyError) cause.mutationOutcome = writeStarted ? "unknown" : "not_applied";
    throw cause;
  });
}
