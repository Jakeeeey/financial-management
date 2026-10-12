import type { DraftSubmission } from "./_payables";

export interface PayableSubmissionLineDetails {
  id: number;
  lineNo: number | null;
  amount: number;
  referenceNo: string | null;
  date: string | null;
  coaId: number | null;
  divisionId: number | null;
  remarks: string | null;
  receipts: Array<{ id: number; fileId: string | null }>;
}

export interface PayableSubmissionDetails {
  submissionId: number;
  departmentId: number | null;
  canEdit: boolean;
  lines: PayableSubmissionLineDetails[];
}

export function canEditPayableSubmission(
  submission: DraftSubmission,
  userId: number,
): boolean {
  return ["draft", "returned"].includes((submission.status || "").toLowerCase())
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
    departmentId: record.submission.departmentId,
    canEdit: canEditPayableSubmission(record.submission, userId),
    lines: record.submission.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      amount: line.amount,
      referenceNo: line.referenceNo,
      date: line.date,
      coaId: line.coaId,
      divisionId: line.divisionId,
      remarks: line.remarks,
      receipts: line.receipts.map((receipt) => ({ id: receipt.id, fileId: receipt.fileId })),
    })),
  };
}
