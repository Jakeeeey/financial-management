export type ExpenseStatus =
  | "Draft"
  | "Pending Approval"
  | "Submitted To Disbursement"
  | "With Concern"
  | "Rejected";

export interface UserInfo {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
  user_position?: string;
}

export interface DivisionInfo {
  division_id: number;
  division_name: string;
  division_code?: string;
}

export interface DepartmentOption {
  department_id: number;
  department_name: string;
  division_id?: number;
}

export interface SupplierOption {
  id: number;
  supplier_name: string;
}

export interface ChartOfAccountOption {
  coa_id: number;
  account_title: string;
  gl_code?: string;
}

export interface ExpenseLogEntry {
  id: number;
  expense_id: number;
  action: string;
  remarks?: string | null;
  receipt_url?: string | null;
  created_by?: number | UserInfo | null;
  created_at?: string | null;
}

export interface ExpenseItem {
  id: number;
  doc_no: string;
  expense_date: string;
  payee: number;
  payee_name?: string;
  is_employee?: boolean | number;
  division_id?: number | null;
  department_id?: number | null;
  coa_id: number;
  amount: number;
  receipt_url?: string | null;
  remarks?: string | null;
  status: ExpenseStatus;
  current_approval_level?: number;
  is_final_approved?: boolean | number;
  disbursement_id?: number | null;
  disbursement_payable_id?: number | null;
  created_by?: number | UserInfo | null;
  created_at?: string | null;
  has_concern?: boolean;
}

export type GridViewMode = "amounts" | "receipts" | "both";

export interface InspectorFilterState {
  search: string;
  encoderId: number | null;
  coaIds: number[];
  dateFrom: string;
  dateTo: string;
}

export interface MatrixCellData {
  items: ExpenseItem[];
  totalAmount: number;
  count: number;
  hasConcern: boolean;
  hasRejected: boolean;
}
