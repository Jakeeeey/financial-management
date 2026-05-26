export type LedgerEntryType =
  | "OPENING_BALANCE"
  | "DEPOSIT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "DISBURSEMENT";

export type UnifiedBankLedgerBank = {
  bankId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
  label: string;
  isActive: boolean;
};

export type UnifiedBankLedgerEntry = {
  id: string;
  bankId: number;
  transactionDate: string;
  transactionType: LedgerEntryType;
  referenceTable: string;
  referenceId: number;
  referenceNo: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
};

export type UnifiedBankLedgerSummary = {
  currentBalance: number;
  totalDebits: number;
  totalCredits: number;
  entryCount: number;
};

export type UnifiedBankLedgerPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UnifiedBankLedgerData = {
  banks: UnifiedBankLedgerBank[];
  selectedBankId: number | null;
  entries: UnifiedBankLedgerEntry[];
  summary: UnifiedBankLedgerSummary;
  pagination: UnifiedBankLedgerPagination;
};

export type UnifiedBankLedgerQuery = {
  bankId?: number | null;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
