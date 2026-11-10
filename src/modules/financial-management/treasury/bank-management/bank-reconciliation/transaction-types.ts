import type { ReconciliationPeriod } from "./setup-types";
import type { AccountReference } from "./reference-types";

export type TransactionSide = "BANK" | "LEDGER";
export type TransactionFilter = "ALL" | "TO_REVIEW" | "MATCHED";
export type TransactionLine = {
  id: number; date: string; reference: string; description: string; amount: string;
  origin: "MANUAL" | "IMPORT" | "GL"; sourceKey: string | null; status: string;
  matchId: number | null; workbenchPosted: boolean; stale: boolean; offsetAccount: string; canDelete: boolean;
  canMatch: boolean; canUnmatch: boolean; canEditTreatment: boolean; canEditOffset: boolean; needsAccount: boolean;
  matchLabel: string | null; matchDifference: string | null; matchClassification: "BOOK_ERROR" | "BANK_ERROR" | null;
  treatment: "RECORD_IN_BOOKS" | "BANK_ERROR" | null; offsetAccountReference: AccountReference | null;
};
export type ReconciliationSummary = {
  adjustedBankBalance: string | null; adjustedBookBalance: string | null; difference: string | null;
  status: "UNRECONCILED" | "BALANCED_NEEDS_ACCOUNT" | "RECONCILED" | null; statusLabel: string;
  needsAccountCount: number; unpostedCount: number; adjustmentCount: number; matchedLines: number; totalLines: number;
  ditTotal: string; outstandingCheckTotal: string; bankErrorCorrection: string; creditMemoTotal: string; debitMemoTotal: string; bookErrorCorrection: string;
};
export type TransactionPane = {
  items: TransactionLine[]; total: number; matched: number; open: number; net: string;
  filtered: number; page: number; pageSize: number;
};
export type TransactionData = {
  period: ReconciliationPeriod; bank: TransactionPane; ledger: TransactionPane;
  counts: { all: number; toReview: number; matched: number };
  reconciliation: ReconciliationSummary;
};
export type ImportRow = { row: number; date: string; reference: string; description: string; moneyIn: string; moneyOut: string; error: string };
export type ImportReport = {
  id: number; side: TransactionSide; requestId: string; fileName: string; imported: number; invalid: number; duplicates: number;
  issues: { row: number; kind: "INVALID" | "DUPLICATE"; message: string }[];
};
export type TransactionResult = {
  period: ReconciliationPeriod; lineId?: number; report?: ImportReport; reconciliation?: ReconciliationSummary;
  matches?: { id: number; label: string }[]; undone?: number; locked?: number;
  autoMatch?: { groups: number; passes: { pass1: number; pass2: number; bankToLedger: number; ledgerToBank: number }; bankLines: number; ledgerLines: number; ambiguousLines: number; deferredLines: number };
};
export const IMPORT_LAYOUTS = {
  BANK: { sheet: "Bank statement", filename: "Bank statement import template.xlsx", headers: ["Date", "Reference", "Description", "Deposit (money in)", "Withdrawal (money out)"] },
  LEDGER: { sheet: "Ledger", filename: "Ledger import template.xlsx", headers: ["Date", "Reference", "Description", "Debit (money in)", "Credit (money out)"] },
} as const;
