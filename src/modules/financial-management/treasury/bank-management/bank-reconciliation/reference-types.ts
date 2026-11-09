import type { BankReconciliationWorkspaceKey } from "./workspaces";

export type BankReconciliationContext = {
  actor: { id: number; name: string; email: string };
  workspaces: { key: BankReconciliationWorkspaceKey; title: string; path: string }[];
};

export type CompanyReference = { id: number; code: string; name: string };
export type BankAccountReference = {
  id: number;
  bankName: string;
  branch: string;
  maskedAccountNumber: string | null;
  currency: string;
  status: string;
  isActive: boolean;
};
export type AccountReference = {
  id: number;
  code: string;
  name: string;
  status: string;
  classification: string;
};
export type BankReconciliationReferences = {
  companies: CompanyReference;
  "bank-accounts": BankAccountReference;
  accounts: AccountReference;
};
export type BankReconciliationReferenceResource = keyof BankReconciliationReferences;
export type BankReconciliationReferencePage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type BankReconciliationReferenceQuery = { search?: string; page?: number; pageSize?: number };
