import type {
  LogisticsWerPayableSubmission,
  LogisticsWerSupplierEligibility,
} from "../../logistics-wer/types";

const ENDPOINT = "/api/fm/reports/logistics-wer-approval";

export interface ApprovalQueueItem {
  submission: LogisticsWerPayableSubmission;
  dispatchPlanId: number;
  dispatchPlanDocNo: string;
  dispatchPlanAmount: number;
  dispatchPlanStatus: string | null;
}

export interface ApprovalQueuePage {
  content: ApprovalQueueItem[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  statusCounts?: Record<string, number>;
}

export interface ApprovalQueueQuery {
  status: string;
  search: string;
  page: number;
  size: number;
}

export interface SubmissionReview {
  submission: LogisticsWerPayableSubmission;
  dispatchPlanId: number;
  dispatchPlanDocNo: string;
  dispatchPlanStatus: string | null;
  plannedAmount: number | null;
  reservedAmount: number | null;
  remainingAmount: number | null;
  supplierEligibility: LogisticsWerSupplierEligibility | null;
}

export type ApprovalDecision = "approve" | "return" | "reject";

export interface DecisionResult {
  submission: LogisticsWerPayableSubmission;
  disbursementId: number | null;
  idempotent: boolean;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Approval request failed with status ${response.status}.`);
  }
  return payload as T;
}

export async function fetchApprovalQueue(query: ApprovalQueueQuery): Promise<ApprovalQueuePage> {
  const params = new URLSearchParams({
    status: query.status,
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search.trim()) params.set("search", query.search.trim());
  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJson<ApprovalQueuePage>(response);
}

export async function fetchSubmissionReview(submissionId: number): Promise<SubmissionReview> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(String(submissionId))}`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJson<SubmissionReview>(response);
}
export async function decideSubmission(
  submissionId: number,
  decision: ApprovalDecision,
  remarks?: string,
): Promise<DecisionResult> {

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(String(submissionId))}/decision`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, remarks }),
    cache: "no-store",
  });
  const payload = await readJson<{ draft?: LogisticsWerPayableSubmission; disbursementId?: unknown; idempotent?: unknown }>(response);
  return {
    submission: payload.draft as LogisticsWerPayableSubmission,
    disbursementId: typeof payload.disbursementId === "number" ? payload.disbursementId : null,
    idempotent: payload.idempotent === true,
  };
}

export interface BulkDecisionItemResult {
  submissionId: number;
  ok: boolean;
  message: string | null;
  disbursementId: number | null;
  idempotent: boolean;
}

export interface BulkDecisionResult {
  results: BulkDecisionItemResult[];
  decided: number;
  failed: number;
}

export async function decideSubmissionsBulk(
  submissionIds: number[],
  decision: ApprovalDecision,
  remarks?: string,
): Promise<BulkDecisionResult> {
  const response = await fetch(`${ENDPOINT}/decisions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionIds, decision, remarks }),
    cache: "no-store",
  });
  return readJson<BulkDecisionResult>(response);
}
