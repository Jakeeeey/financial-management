export type AdjustingEntryStatus = "Draft" | "Posted" | "Voided";

export type AdjustingEntryDetail = {
  id: number | null;
  coaId: number | null;
  accountNumber: string | null;
  accountTitle: string | null;
  debit: number;
  credit: number;
};

export type AdjustingEntry = {
  id: number;
  jeNo: string | null;
  transactionDate: string;
  description: string;
  status: AdjustingEntryStatus;
  divisionId: number | null;
  divisionName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  creatorId: number | null;
  creatorName: string | null;
  dateCreated: string | null;
  datePosted: string | null;
  sourceJeNo: string | null;
  sourceJeGroupCounter: number | null;
  sourceModule: string | null;
  sourceTransactionRef: string | null;
  sourceTransactionDate: string | null;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  combinedVariance?: number;
  details: AdjustingEntryDetail[];
};

export type AdjustingEntryPayload = {
  transactionDate: string;
  description: string;
  divisionId: number | null;
  departmentId: number | null;
  sourceJeNo?: string | null;
  sourceJeGroupCounter?: number | null;
  sourceModule?: string | null;
  sourceTransactionRef?: string | null;
  sourceTransactionDate?: string | null;
  details: Array<{
    coaId: number;
    debit: number;
    credit: number;
  }>;
};

export type AdjustingEntryPage = {
  content: AdjustingEntry[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type AdjustingEntrySummary = {
  draft: number;
  posted: number;
  voided: number;
  imbalanced: number;
  totalRecords: number;
};

export type AdjustingEntrySourceTotals = {
  sourceJeNo: string;
  totalDebit: number;
  totalCredit: number;
  variance: number;
};

export type AdjustingEntryPostedAdjustmentHistory = {
  sourceJeNo: string;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  entries: Array<{
    id: number;
    jeNo: string | null;
    transactionDate: string | null;
    description: string | null;
    status: string | null;
    totalDebit: number;
    totalCredit: number;
    variance: number;
    details: Array<{
      id: number | null;
      coaId: number | null;
      accountNumber: string | null;
      accountTitle: string | null;
      debit: number;
      credit: number;
    }>;
  }>;
};

export type AdjustingEntryQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  divisionId?: number | null;
  departmentId?: number | null;
  sourceJeNo?: string | null;
  sort?: string;
};

export type AdjustingEntrySourceJournal = {
  jeNo: string;
  jeGroupCounter: number | null;
  sourceModule: string | null;
  transactionRef: string | null;
  transactionDate: string | null;
  description: string | null;
  status: string | null;
  division: string | null;
  divisionName: string | null;
  department: string | null;
  departmentName: string | null;
  creator: string | null;
  details: Array<{
    coaId: number | null;
    accountNumber: string | null;
    accountTitle: string | null;
    debit: number;
    credit: number;
  }>;
};

export type AdjustingEntrySourceJournalSummary = {
  jeNo: string;
  jeGroupCounter: number | null;
  sourceModule: string | null;
  transactionRef: string | null;
  transactionDate: string | null;
  description: string | null;
  status: string | null;
};

export type LookupOption = {
  value: string;
  label: string;
};

export type DivisionLookup = {
  id: number;
  name: string;
};

export type DepartmentLookup = {
  id: number;
  name: string;
  parentDivision: number | null;
};
