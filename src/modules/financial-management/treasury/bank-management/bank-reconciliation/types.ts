export type ReconciliationStatus = "DRAFT" | "RECONCILED";

export type BankReconciliationBank = {
  bankId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
  label: string;
  isActive: boolean;
};

export type BankReconciliation = {
  id: number;
  bankId: number;
  bankName: string;
  bankLabel: string;
  statementDate: string;
  statementBalance: number;
  systemBalance: number;
  variance: number;
  status: ReconciliationStatus;
  remarks: string;
  preparedBy: number | null;
  approvedBy: number | null;
  createdAt: string;
};

export type BankReconciliationPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
};

export type BankReconciliationData = {
  reconciliations: BankReconciliation[];
  banks: BankReconciliationBank[];
  pagination: BankReconciliationPagination;
};

export type BankReconciliationSystemBalancePreview = {
  bankId: number;
  statementDate: string;
  systemBalance: number;
};

export type BankReconciliationQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ReconciliationStatus | "ALL";
  bankId?: number | null;
  startDate?: string;
  endDate?: string;
};

export type BankReconciliationFormValues = {
  bankId: string;
  statementDate: string;
  statementBalance: string;
  remarks: string;
};
