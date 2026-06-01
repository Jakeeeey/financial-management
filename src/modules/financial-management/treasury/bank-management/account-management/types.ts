// src/modules/financial-management/treasury/bank-management/account-management/types.ts
export type BankAccount = {
  bankId: number;
  bankName: string;
  accountNumber: string;
  bankDescription: string;
  branch: string;
  ifscCode: string;
  openingBalance: number;
  province: string;
  city: string;
  baranggay: string;
  email: string;
  mobileNo: string;
  contactPerson: string;
  isActive: boolean;
};

export type BankNameOption = {
  id: number;
  bankName: string;
  isActive?: boolean;
};

export type PsgcOption = {
  code: string;
  name: string;
  provinceCode?: string;
  cityCode?: string;
};

export type AccountManagementPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
};

export type AccountManagementData = {
  accounts: BankAccount[];
  bankNames: BankNameOption[];
  pagination: AccountManagementPagination;
};

export type AccountManagementFormValues = {
  bankName: string;
  accountNumber: string;
  bankDescription: string;
  branch: string;
  ifscCode: string;
  openingBalance: string;
  province: string;
  city: string;
  baranggay: string;
  email: string;
  mobileNo: string;
  contactPerson: string;
};

export type AccountStatusFilter = "all" | "active" | "inactive";
