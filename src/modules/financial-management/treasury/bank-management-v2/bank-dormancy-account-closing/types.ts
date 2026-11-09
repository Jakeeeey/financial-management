/**
 * View models for Dormancy & Account Closing (FSD §3.5, sub-module 1.5).
 *
 * Server rows stay snake_case; services map them to these camelCase shapes.
 * Dates are PHT wall-clock strings, money is a number.
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

/** FSD Table 9 classification, derived from months without customer activity. */
export type DormancyClass =
  | "ACTIVE"
  | "INACTIVE"
  | "DORMANT_ELIGIBLE"
  | "DORMANT"
  | "ESCHEAT_ELIGIBLE";

export interface DormancyAccount {
  bankId: number;
  bankName: string;
  accountNumber: string;
  accountName: string | null;
  accountType: string | null;
  branch: string | null;
  currency: Currency;
  glCoaId: number | null;
  glCode: string | null;
  glTitle: string | null;
  status: BankAccountStatus;
  bookBalance: number;
  /** Newest customer-initiated movement: a deposit, transfer, release or issued check. */
  lastCustomerActivity: string | null;
  lastActivitySource: string | null;
  monthsInactive: number;
  classification: DormancyClass;
  dormantSince: string | null;
  escheatedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  retainUntil: string | null;
}

export interface DormancyFilter {
  bankName: string | null;
  classification: DormancyClass | "ALL";
  status: BankAccountStatus | "ALL";
  q: string;
}

export interface PreClosureCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PreClosureResult {
  bankId: number;
  accountLabel: string;
  bookBalance: number;
  canClose: boolean;
  checks: PreClosureCheck[];
}

export interface SettlementInput {
  accruedInterest: number;
  cutOff: string;
}

export interface SettlementPlan {
  accruedInterest: number;
  taxRate: number;
  taxAmount: number;
  netPayout: number;
  draft: JournalEntryDraft;
  preview: ResolvedJournalEntry;
}

/** One leg of a proposed journal entry, before GL codes are resolved. */
export interface JournalLineDraft {
  mappingKey: GlMappingKey | string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntryDraft {
  eventCode: string;
  sourceModule: string;
  sourceRef: string;
  postingDate: string;
  description: string;
  lines: JournalLineDraft[];
}

export interface ResolvedJournalLine {
  lineNo: number;
  coaId: number | null;
  glCode: string | null;
  accountTitle: string | null;
  debit: number;
  credit: number;
  memo: string | null;
}

export interface ResolvedJournalEntry {
  eventCode: string;
  sourceModule: string;
  sourceRef: string;
  postingDate: string;
  description: string;
  lines: ResolvedJournalLine[];
  totalDebit: number;
  totalCredit: number;
  missingMappingKeys: string[];
}

export interface PostedJournalEntry extends ResolvedJournalEntry {
  id: number;
  jeNo: string;
  status: "POSTED" | "REVERSED";
  reversesJeNo: string | null;
  createdAt: string;
}

export type GlMappingKey =
  | "DEPOSIT_LIABILITY_ACTIVE"
  | "DORMANT_LIABILITY"
  | "ESCHEAT_PAYABLE"
  | "CLOSURE_PAYOUT"
  | "DEPOSIT_INTEREST_EXPENSE"
  | "FINAL_TAX_PAYABLE";

export interface GlMappingRow {
  mappingKey: string;
  coaId: number | null;
  glCode: string | null;
  accountTitle: string | null;
  updatedAt: string | null;
}

export interface DormancySnapshot {
  accounts: DormancyAccount[];
  notice?: string;
}

export interface ActionOutcome {
  message: string;
  journalNo: string | null;
  postingBlocked: boolean;
  missingMappingKeys: string[];
}
