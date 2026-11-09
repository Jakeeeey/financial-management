import type { AccountReference, BankAccountReference, CompanyReference, BankReconciliationReferencePage } from "./reference-types";

export type BankConfiguration = BankAccountReference & {
  companyId: number | null; glCoaId: number | null; version: number;
  company: CompanyReference | null; account: AccountReference | null;
};
export type PeriodDraft = {
  version?: number; bankId: number; companyId: number | null; currency: string;
  periodEnd: string | null; statementOpening: string | null; statementEnding: string | null;
};
export type ReconciliationPeriod = PeriodDraft & {
  id: number; version: number; status: "OPEN" | "CLOSED"; bank: BankConfiguration;
  ledgerBlockers: string[]; ledgerBalance: string | null; ledgerAsOf: string | null; updatedAt: string;
  setupWarning?: string; changedSources?: number;
  statementCheck: { state: "NOT_AVAILABLE" | "AGREES" | "WARNING"; message: string; calculated?: string; difference?: string };
};
export type LedgerLine = { id: number; sourceKey: string | null; sourceFingerprint: string | null; date: string; reference: string; description: string; amount: string };
export type LedgerPage = BankReconciliationReferencePage<LedgerLine>;
export type MasterOptions = { bsis: { id: number; name: string }[]; accountTypes: { id: number; name: string }[]; balanceTypes: { id: number; name: string }[] };
