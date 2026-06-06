// src/modules/financial-management/treasury/bank-management/account-management/types.ts
export type BankAccount = {
  bankId: number;
  bankName: string;
  accountType: string;
  accountName: string;
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
  createdAt: string;
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
  bankName: string;
  accountType: string;
  accountName: string;
  createdFrom: string;
  createdTo: string;
};

export type AccountManagementData = {
  accounts: BankAccount[];
  bankNames: BankNameOption[];
  pagination: AccountManagementPagination;
};

export type AccountManagementFormValues = {
  bankName: string;
  accountType: string;
  accountName: string;
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

export type AccountManagementQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AccountStatusFilter;
  bankName?: string;
  accountType?: string;
  accountName?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type AccountManagementFieldErrors = Partial<
  Record<keyof AccountManagementFormValues, string>
>;

export type AccountManagementSaveResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors?: AccountManagementFieldErrors;
    };
