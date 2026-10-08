import type { DraftSubmission } from "./_payables";

export interface PayableSubmissionLineDetails {
  id: number;
  lineNo: number | null;
  amount: number;
  referenceNo: string | null;
  date: string | null;
  coaId: number | null;
  remarks: string | null;
  receipts: Array<{ id: number; fileId: string | null }>;
}

export interface PayableSubmissionDetails {
  submissionId: number;
  canEdit: boolean;
  lines: PayableSubmissionLineDetails[];
}

export function canEditReturnedSubmission(
  submission: DraftSubmission,
  userId: number,
): boolean {
  return (submission.status || "").toLowerCase() === "returned"
    && submission.submittedBy === userId
    && submission.disbursementId === null;
}

export function toPayableSubmissionDetails(
  record: { planId: number; submission: DraftSubmission } | null,
  expectedPlanId: number,
  userId: number,
): PayableSubmissionDetails | null {
  if (!record || record.planId !== expectedPlanId) return null;

  return {
    submissionId: record.submission.id,
    canEdit: canEditReturnedSubmission(record.submission, userId),
    lines: record.submission.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      amount: line.amount,
      referenceNo: line.referenceNo,
      date: line.date,
      coaId: line.coaId,
      remarks: line.remarks,
      receipts: line.receipts.map((receipt) => ({ id: receipt.id, fileId: receipt.fileId })),
    })),
  };
}
