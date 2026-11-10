import type { AccountReference, CompanyReference } from "./reference-types";
import type { ReconciliationPeriod } from "./setup-types";
import type { ReconciliationSummary } from "./transaction-types";

export type PostingEntry = {
  key: string; sourceType: "BANK_LINE" | "MATCH" | "JOURNAL"; sourceId: number; sourceLabel: string; sourceDate: string | null;
  status: "NEEDS_ACCOUNT" | "READY" | "PENDING" | "EXPORTED" | "FAILED" | "POSTED" | "REVERSED" | "REVERSAL" | "WITHDRAWN" | "SUPERSEDED"; journalId: number | null; journalNumber: string | null;
  workbenchId?: number; workbenchNumber?: string; glStatus?: "PENDING" | "EXPORTED" | "FAILED" | "POSTED";
  importReference?: string; sourceHash?: string; reversesNumber?: string; reversedByNumber?: string; lastError?: string; stale?: boolean;
  canPost?: boolean; canReverse?: boolean; canRetry?: boolean; canExport?: boolean; canVerify?: boolean; canWithdraw?: boolean;
  date: string | null; explanation: string; issues: string[]; postedBy: string | null; postedAt: string | null;
  lines: { account: AccountReference | null; debit: string; credit: string; role: "CASH" | "OFFSET" | null }[];
};
export type PostingCommand = { requestId: string; version: number; bankVersion: number; sourceKeys?: string[]; journalId?: number; glJournalId?: number; acknowledgeWithdrawal?: boolean };
export type PostingAction = "post" | "reverse" | "retry" | "prepare-export" | "verify-import" | "withdraw";
export type PostingReceipt = { requestId: string; state: "PENDING" | "POSTED" | "PREPARED" | "EXPORTED" | "FAILED" | "WITHDRAWN"; journalIds: number[]; error: string | null; data: PostingData };
export type FallbackExportData = { period: ReconciliationPeriod; entity: CompanyReference | null; entries: PostingEntry[]; requestId: string; version: number; generatedAt: string; generatedBy: number };
export type ImportedJournalChoice = { id: number; je_no: string; reference: string; transaction_date: string; status: string; entry_origin: string; source_module: string | null };
export type PostingData = {
  closureEligibility?: { canClose: boolean; blockers: string[] };
  period: ReconciliationPeriod; entity: CompanyReference | null;
  postingDate: { override: string | null; effective: string | null; min: string | null; max: string | null; valid: boolean; message: string };
  summary: { ledgerBefore: string | null; postedCashEffect: string | null; ledgerAfter: string | null; adjustedBookBalance: string | null; stillToPost: string | null };
  entries: PostingEntry[]; totals: { debit: string; credit: string }; reconciliation: ReconciliationSummary;
};
export type PostingExportData = PostingData & { filename: string; generatedAt: string; generatedBy: { id: number; name: string } };
