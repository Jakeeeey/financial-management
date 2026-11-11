import type { CompanyReference } from "./reference-types";
import type { ReconciliationPeriod } from "./setup-types";
import type { ReconciliationSummary } from "./transaction-types";
import type { PostingData } from "./posting-types";

export type StatementGroup = { label: string; total: string; items: { reference: string; description: string; amount: string }[] };
export type StatementSection = {
  part: string; title: string; openingLabel: string; openingBalance: string | null;
  groups: StatementGroup[]; adjustedLabel: string; adjustedBalance: string | null;
};
export type AgingItem = {
  id: number; type: "Deposit in transit" | "Outstanding check"; date: string; reference: string; description: string;
  amount: string; days: number | null; bucket: number | null; stale: boolean;
};
export type FinancialReports = {
  period: ReconciliationPeriod; entity: CompanyReference | null; reconciliation: ReconciliationSummary;
  statement: StatementSection[];
  aging: { available: boolean; items: AgingItem[]; count: number; net: string; buckets: string[]; totals: (string | null)[] };
  journal: Pick<PostingData, "entries" | "totals" | "summary" | "postingDate">;
};

export type AuditEvent = {
  id: number; occurredAt: string; actor: { id: number; name: string }; actionCode: string; actionLabel: string;
  scope: "Period" | "Bank setup"; summary: string; notice: string | null;
  changes: { label: string; type: "money" | "text"; before: string | null; after: string | null }[];
  facts: { label: string; value: string }[];
};
export type ClosedPeriod = {
  periodId: number; closureId: number; revision: number; periodEnd: string | null; currency: string | null;
  closedAt: string; closedBy: { id: number; name: string }; adjustedBankBalance: string | null; adjustedBookBalance: string | null;
  entryCount: number | null; journals: { glId: number; workbenchNumber: string | null; glNumber: string | null }[];
  available: boolean; notice: string | null;
};
export type HistoryPage<T> = { items: T[]; total: number; page: number; pageSize: number; throughEventId?: number; throughClosureId?: number };
export type ReportKey = "statement" | "aging" | "journal" | "audit" | "closedPeriods";
export type ReportsExportData = FinancialReports & {
  audit: AuditEvent[]; closedPeriods: ClosedPeriod[]; throughEventId: number; throughClosureId: number;
  filename: string; generatedAt: string; generatedBy: { id: number; name: string };
};
