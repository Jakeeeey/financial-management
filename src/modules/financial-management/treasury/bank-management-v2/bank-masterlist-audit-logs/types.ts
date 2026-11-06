/**
 * View models for the Master List & Audit Logs lane.
 *
 * Server rows are snake_case Directus records; the service maps them to these
 * camelCase shapes so components never see a raw row. Amounts are numbers, dates are
 * PHT wall-clock strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`).
 */

export type BankAccountStatus = "ACTIVE" | "DORMANT" | "CLOSED";
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
