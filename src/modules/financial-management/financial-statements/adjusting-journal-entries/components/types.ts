import type { AdjustingEntry, AdjustingEntryPayload } from "../types";

export type DetailFormRow = {
  localId: string;
  id: number | null;
  coaId: string;
  debit: string;
  credit: string;
};

export type EntryForm = {
  transactionDate: string;
  divisionId: string;
  departmentId: string;
  description: string;
  details: DetailFormRow[];
};

export type SourceReferencePayload = Pick<
  AdjustingEntryPayload,
  "sourceJeNo" | "sourceJeGroupCounter" | "sourceModule" | "sourceTransactionRef" | "sourceTransactionDate"
>;

export type EntryAction = "post" | "delete";
export type SortKey = "id" | "jeNo" | "transactionDate" | "status";
export type SortDirection = "asc" | "desc";

export type PendingAction = {
  entry: AdjustingEntry;
  action: EntryAction;
  combinedVariance?: number;
};

export type MoneyTotals = {
  totalDebit: number;
  totalCredit: number;
  variance: number;
};
