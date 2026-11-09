/**
 * View models for the Cash & Bank Transactions lane (FSD 1.2).
 *
 * The list mixes two source collections — `bank_memos` and `bank_transfers` — so both are
 * flattened into one `TransactionRow` before they reach a component. Amounts are numbers,
 * dates are PHT wall-clock `YYYY-MM-DD`.
 */

export type TransactionKind = "CREDIT" | "DEBIT" | "INTEREST" | "TRANSFER";

/** Which way the row moved the bank account's balance. */
export type TransactionDirection = "IN" | "OUT";

export type MemoType = "CREDIT" | "DEBIT" | "INTEREST";

export interface TransactionRow {
  /** Stable React key: `memo-12` or `transfer-7`. */
  key: string;
  id: number;
  kind: TransactionKind;
  refNo: string;
  /** Value date (PHT) — the date the bank applied the transaction. */
  date: string;
  valueDate: string;
  accountLabel: string;
  /** Destination account for transfers. */
  counterpartLabel: string | null;
  amount: number;
  fee: number;
  direction: TransactionDirection;
  status: string;
  jeNo: string | null;
  description: string | null;
}

export interface AccountOption {
  bankId: number;
  /** Drawn from `bank_accounts.bank_name`; the list filters by bank, not only by account. */
  bankName: string;
  label: string;
  currency: string;
  bookBalance: number;
}

export interface ExpenseAccountOption {
  coaId: number;
  glCode: string;
  title: string;
}

export interface TransactionsPayload {
  rows: TransactionRow[];
  page: number;
  pageSize: number;
  total: number;
  accounts: AccountOption[];
  expenseAccounts: ExpenseAccountOption[];
  /** PENDING transfers still parked in TRANSFER_IN_TRANSIT. */
  clearing: TransactionRow[];
  /** Set when a not-yet-created collection made part of the page unavailable. */
  notice: string | null;
}

export interface TransactionFilters {
  kind: "ALL" | TransactionKind;
  bankName: string | null;
  bankAccountId: number | null;
  status: string;
  from: string;
  to: string;
  q: string;
  page: number;
}

// ---------------------------------------------------------------------------
// Journal entry plumbing (shared shapes for the posting engine)
// ---------------------------------------------------------------------------

/** One leg of a proposed journal entry, before GL codes are resolved. */
export interface JournalLineDraft {
  mappingKey: string;
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

export interface GlMappingRow {
  mappingKey: string;
  coaId: number | null;
  glCode: string | null;
  accountTitle: string | null;
  updatedAt: string | null;
}
