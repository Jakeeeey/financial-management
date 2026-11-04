export type Choice = { id: number; code: string; name: string; status: string; classification: string; eligible: boolean; reason: string | null; details: Record<string, unknown> };
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Blocker = { code: string; field: string; message: string };
export type Readiness = { ready: boolean; blockers: Blocker[] };
export type MasterLinks = Record<string, { path: string | null; allowed: boolean }>;
export const ACCOUNT_ROLES = {
  FUNDING_CASH: "Funding cash / bank", PETTY_CASH_FUND: "Petty Cash Fund", INPUT_VAT: "Input VAT",
  EWT_PAYABLE: "EWT Payable", CASH_OVER_SHORT: "Cash Over / Short", EXPENSE: "Allowed expense accounts",
} as const;
export type AccountRole = keyof typeof ACCOUNT_ROLES;
export type Settings = {
  version: number; companyId: number | null; signatoryUserId: number | null; signatoryTitle: string; signatoryTin: string;
  usageWarning: number; usageCritical: number; staleDays: number; accounts: Record<AccountRole, number[]>;
  resolvedAccounts: Record<AccountRole, Choice[]>; company: Choice | null; signatory: Choice | null; readiness: Record<string, Readiness>;
};
export type Profile = { id: number; version: number; supplierId: number; payeeKind: "INDIVIDUAL" | "CORPORATION"; vatRegistered: boolean;
  taxAddress: string; postalCode: string; defaultExpenseCoaId: number | null; supplier: Choice; defaultExpenseAccount: Choice | null; readiness: Readiness };
export type TaxRule = { id: number; version: number; ruleKind: "VAT" | "EWT"; code: string; payeeKind: "INDIVIDUAL" | "CORPORATION" | "BOTH";
  rate: number; effectiveFrom: string; effectiveTo: string | null; documentTypes: string[]; state: "DRAFT" | "VERIFIED" | "RETIRED";
  sourceReference: string; verificationNote: string; verifiedBy: number | null; verifiedAt: string | null };
export type Fund = { id: number; docNo: string; name: string | null; status: string; imprestAmount: number | null; perVoucherLimit: number | null; approvalThreshold: number | null; version: number };
