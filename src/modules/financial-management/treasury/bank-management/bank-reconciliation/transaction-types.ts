import type { ReconciliationPeriod } from "./setup-types";

export type TransactionSide = "BANK" | "LEDGER";
export type TransactionFilter = "ALL" | "TO_REVIEW" | "MATCHED";
export type TransactionLine = {
  id: number; date: string; reference: string; description: string; amount: string;
  origin: "MANUAL" | "IMPORT" | "GL"; sourceKey: string | null; status: string;
  matchId: number | null; workbenchPosted: boolean; stale: boolean; offsetAccount: string; canDelete: boolean;
};
export type TransactionPane = {
  items: TransactionLine[]; total: number; matched: number; open: number; net: string;
  filtered: number; page: number; pageSize: number;
};
export type TransactionData = {
  period: ReconciliationPeriod; bank: TransactionPane; ledger: TransactionPane;
  counts: { all: number; toReview: number; matched: number };
};
export type ImportRow = { row: number; date: string; reference: string; description: string; moneyIn: string; moneyOut: string; error: string };
export type ImportReport = {
  id: number; side: TransactionSide; requestId: string; fileName: string; imported: number; invalid: number; duplicates: number;
  issues: { row: number; kind: "INVALID" | "DUPLICATE"; message: string }[];
};
export type TransactionResult = { period: ReconciliationPeriod; lineId?: number; report?: ImportReport };
export const IMPORT_LAYOUTS = {
  BANK: { sheet: "Bank statement", filename: "Bank statement import template.xlsx", headers: ["Date", "Reference", "Description", "Deposit (money in)", "Withdrawal (money out)"] },
  LEDGER: { sheet: "Ledger", filename: "Ledger import template.xlsx", headers: ["Date", "Reference", "Description", "Debit (money in)", "Credit (money out)"] },
} as const;
