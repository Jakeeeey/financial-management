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
  totalDebit: number;
  totalCredit: number;
  variance: number;
  details: AdjustingEntryDetail[];
};

export type AdjustingEntryPayload = {
  transactionDate: string;
  description: string;
  divisionId: number | null;
  departmentId: number | null;
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

export type AdjustingEntryQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  divisionId?: number | null;
  departmentId?: number | null;
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
