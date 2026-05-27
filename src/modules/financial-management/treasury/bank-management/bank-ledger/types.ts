export type LedgerEntryType =
  | "OPENING_BALANCE"
  | "DEPOSIT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "DISBURSEMENT";

export type BankLedgerBank = {
  bankId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
  label: string;
  isActive: boolean;
};

export type BankLedgerEntry = {
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

export type BankLedgerSummary = {
  currentBalance: number;
  totalDebits: number;
  totalCredits: number;
  entryCount: number;
};

export type BankLedgerPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type BankLedgerData = {
  banks: BankLedgerBank[];
  selectedBankId: number | null;
  entries: BankLedgerEntry[];
  summary: BankLedgerSummary;
  pagination: BankLedgerPagination;
};

export type BankLedgerQuery = {
  bankId?: number | null;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
