export type TransferStatus = "PREPARED" | "PENDING" | "COMPLETED" | "CANCELLED";

export type BankTransferBank = {
  bankId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
  label: string;
  isActive: boolean;
};

export type BankTransfer = {
  transferId: number;
  transferNo: string;
  transferDate: string;
  sourceBankId: number;
  sourceBankName: string;
  sourceBankLabel: string;
  destinationBankId: number;
  destinationBankName: string;
  destinationBankLabel: string;
  amount: number;
  transferFee: number;
  totalOutflow: number;
  status: TransferStatus;
  preparedBy: number | null;
  datePrepared: string;
  remarks: string;
};

export type BankTransfersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
};

export type BankTransfersData = {
  transfers: BankTransfer[];
  banks: BankTransferBank[];
  pagination: BankTransfersPagination;
};

export type BankTransferQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TransferStatus | "ALL";
  sourceBankId?: number | null;
  destinationBankId?: number | null;
  startDate?: string;
  endDate?: string;
};

export type BankTransferFormValues = {
  transferDate: string;
  sourceBankId: string;
  destinationBankId: string;
  amount: string;
  transferFee: string;
  remarks: string;
};
