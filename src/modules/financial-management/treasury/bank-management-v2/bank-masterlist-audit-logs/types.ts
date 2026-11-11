/**
 * View models for the Master List & Audit Logs lane.
 *
 * Server rows are snake_case Directus records; the service maps them to these
 * camelCase shapes so components never see a raw row. Amounts are numbers, dates are
 * PHT wall-clock strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`).
 */

/** Canonical account status vocabulary for the whole bank-management family. Transactable = is_active && ACTIVE. */
export type BankAccountStatus = "ACTIVE" | "DORMANT" | "INACTIVE" | "ESCHEATED" | "CLOSED";
export type Currency = "PHP" | "USD";

export interface BankAccountV2 {
  bankId: number;
  bankName: string;
  accountNumber: string;
  accountName: string | null;
  accountType: string | null;
  branch: string | null;
  currency: Currency;
  ifrsCategory: string;
  glCoaId: number | null;
  glCode: string | null;
  glTitle: string | null;
  status: BankAccountStatus;
  isActive: boolean;
  openingBalance: number;
  bookBalance: number;
  effectiveDate: string | null;
  lastReconciledAt: string | null;
  createdAt: string | null;
}

export type ArfSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

export interface ArfFinding {
  key: string;
  severity: ArfSeverity;
  subModule: string;
  title: string;
  detail: string;
  reference: string | null;
  occurredAt: string | null;
  /** Bank account label when the underlying record names one. */
  account: string | null;
  /** Money at stake in PHP; null when the finding is not about an amount. */
  amount: number | null;
  /** The threshold and condition that produced this row, in the auditor's words. */
  rule: string;
  /** Table row the finding was computed from, e.g. `collection_details #840`. */
  source: string;
}

export interface AuditLogRow {
  id: number;
  occurredAt: string;
  module: string;
  action: string;
  reference: string | null;
  detail: string | null;
  actorName: string | null;
  legacyUtcAt: string | null;
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}
