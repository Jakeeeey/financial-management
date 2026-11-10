import type { ReconciliationPeriod } from "./setup-types";
import type { ReconciliationSummary, TransactionLine } from "./transaction-types";

export type ReconcileExportFormat = "xlsx" | "pdf";
export type ExportPane = { items: (TransactionLine & { jeNumber?: string })[]; total: number; matched: number; open: number; net: string };
export type ExportMatch = {
  id: number; label: string; bankReferences: string[]; ledgerReferences: string[];
  bankAmount: string; ledgerAmount: string; difference: string; treatment: string; offsetAccount: string; jeNumber: string;
};
export type ReconcileExportData = {
  period: ReconciliationPeriod; entity: { id: number; code: string; name: string } | null;
  bank: ExportPane; ledger: ExportPane; matches: ExportMatch[]; reconciliation: ReconciliationSummary;
  generatedAt: string; generatedBy: { id: number; name: string }; filename: string;
};
