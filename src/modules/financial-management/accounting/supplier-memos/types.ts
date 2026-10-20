export type SupplierMemoType = 1 | 2;

export interface MemoApplication {
  id: number;
  documentNo: string;
  status: string;
  amount: number;
  posted: boolean;
}

export interface MemoEligibility {
  canEdit: boolean;
  canCancel: boolean;
  blockedReason: string | null;
  ambiguous: boolean;
  appliedAmount: number | null;
  reservedAmount: number | null;
  remainingAmount: number | null;
  applications: MemoApplication[];
}

export interface SupplierMemo {
  id: number;
  memo_number: string;
  type: number;
  supplier_id: number;
  chart_of_account: number;
  date: string;
  amount: string;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  encoder_id: number | null;
  deleted_at?: string | null;
  supplierName?: string;
  accountName?: string;
  accountCode?: string;
  creatorName?: string;
  eligibility?: MemoEligibility;
}

export interface MemoDetail {
  memo: SupplierMemo;
  eligibility: MemoEligibility;
  revisionToken: string;
}

export interface MemoHistoryEvent {
  id: string;
  action: string;
  outcome: "completed" | "failed" | "needs-review" | "legacy";
  actorName: string;
  occurredAt: string;
  reason: string | null;
  requestId: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface MemoMutationResult {
  data?: SupplierMemo;
  message: string;
  state: "saved" | "saved-audit-pending" | "unknown";
  requestId: string;
}

export interface SupplierMemoFilters {
  search: string;
  supplier_id: string;
  chart_of_account: string;
  status: string;
  date_from?: string;
  date_to?: string;
}

export function memoMatchesFilters(memo: SupplierMemo, filters: SupplierMemoFilters) {
  const search = filters.search.trim().toLowerCase();
  if (search && ![memo.memo_number, memo.reason, memo.status, memo.supplierName, memo.accountName, memo.accountCode, memo.amount]
    .some(value => String(value ?? "").toLowerCase().includes(search))) return false;
  if (filters.supplier_id && String(memo.supplier_id) !== filters.supplier_id) return false;
  if (filters.chart_of_account && String(memo.chart_of_account) !== filters.chart_of_account) return false;
  if (filters.status && memo.status.toUpperCase() !== filters.status.toUpperCase()) return false;
  const date = memo.date.slice(0, 10);
  return !(filters.date_from && date < filters.date_from) && !(filters.date_to && date > filters.date_to);
}

export function memoStats(memos: SupplierMemo[]) {
  const cancelled = memos.filter(memo => memo.status.toUpperCase() === "CANCELLED");
  const active = memos.filter(memo => memo.status.toUpperCase() !== "CANCELLED");
  const available = active.filter(memo => memo.status.toUpperCase() === "AVAILABLE");
  return { total: memos.length, available: available.length,
    cancelled: cancelled.length, cancelledAmount: cancelled.reduce((sum, memo) => sum + Number(memo.amount), 0),
    totalAmount: active.reduce((sum, memo) => sum + Number(memo.amount), 0),
    totalAvailable: available.reduce((sum, memo) => sum + (memo.eligibility?.remainingAmount ?? 0), 0) };
}

export const memoMoney = (value: number | string | null | undefined) => value == null ? "Needs review"
  : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(value));

export const memoDateTime = (value: string) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  }).format(date) + " PHT";
};
