export type AdjustingEntryStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Posted" | "Cancelled" | "Failed" | "Voided";

export type AdjustingEntryDetail = {
  id: number | null;
  coaId: number | null;
  accountNumber: string | null;
  accountTitle: string | null;
  debit: number;
  credit: number;
  departmentId?: number | null;
  departmentName?: string | null;
  description?: string | null;
  originalDetailId?: number | null;
};

export type AdjustingEntry = {
  id: number;
  jeNo: string | null;
  transactionDate: string;
  description: string;
  status: AdjustingEntryStatus;
  reference: string | null;
  entryOrigin: "MANUAL" | "SYSTEM";
  entryKind: "ADJUSTMENT" | "REVERSAL";
  reversalMode: "FULL" | "PARTIAL" | null;
  originalEntryId: number | null;
  version: number;
  preparedBy: number | null;
  submittedBy: number | null;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  postedBy: number | null;
  postedByName: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  lastPostingError: string | null;
  lastPostingAttemptAt: string | null;
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
  reference: string;
  entryKind?: "ADJUSTMENT" | "REVERSAL";
  reversalMode?: "FULL" | "PARTIAL" | null;
  originalEntryId?: number | null;
  creationRequestKey?: string;
  version?: number;
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
    departmentId?: number | null;
    description?: string;
    originalDetailId?: number | null;
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
  submitted: number;
  approved: number;
  rejected: number;
  cancelled: number;
  failed: number;
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
  accountTypeId?: number | null;
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
    departmentId?: number | null;
    departmentName?: string | null;
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

export type AjeAccess = { userId: number; userName: string };
export type AjeAction = "submit" | "approve" | "reject" | "withdraw" | "revise" | "cancel" | "post" | "retry";
export type AjeAccount = { id: number; label: string; accountTypeId: number | null; accountTypeName: string | null; departmentRequired: boolean };
export type AjeAttachment = { id: number; entryId: number; fileId: string; filename: string; mimeType: string; fileSize: number; state: string; uploadedByName: string; uploadedAt: string };
export type AjePeriod = { closedThroughDate: string | null; version: number; updatedByName: string | null; updatedAt: string | null };
export type AjeAuditEvent = { id: number; entryId: number | null; journalNumber: string | null; actorUserId: number; actorName: string; action: string; status: string | null; occurredAt: string; reason: string | null; changes: Array<{ field: string; before: string | null; after: string | null }> };
export type AjeAuditPage = { content: AjeAuditEvent[]; totalPages: number; totalElements: number; number: number; first: boolean; last: boolean };
export type AjeReversalPreview = { original: AdjustingEntry; canFullReverse: boolean; lines: Array<{ originalDetailId: number; coaId: number; accountNumber: string; accountTitle: string; departmentId: number | null; departmentName: string | null; description: string | null; originalDebit: number; originalCredit: number; reversedAmount: number; remainingAmount: number }> };
