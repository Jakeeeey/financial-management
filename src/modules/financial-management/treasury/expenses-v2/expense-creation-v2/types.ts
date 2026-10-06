export type ExpenseStatus =
  | "Draft"
  | "Pending Approval"
  | "Submitted To Disbursement"
  | "With Concern"
  | "Rejected";

export type LogAction =
  | "Draft"
  | "Resubmitted"
  | "Pending Approval"
  | "Approved To Disbursement"
  | "With Concern"
  | "Rejected";

export interface ExpenseItem {
  id: number;
  doc_no: string;
  expense_date: string;
  payee: number;
  is_employee: number | boolean;
  division_id?: number | null;
  department_id?: number | null;
  coa_id: number;
  amount: number;
  remarks?: string | null;
  receipt_url?: string | null;
  status: ExpenseStatus;
  current_approval_level: number;
  is_final_approved: number | boolean;
  is_resubmitted?: number | boolean;
  disbursement_id?: number | null;
  disbursement_payable_id?: number | null;
  created_at: string;
  created_by?: number | null;
  updated_at?: string;
  is_deleted?: number | boolean;
  deleted_at?: string | null;
  deleted_by?: number | null;
}

export interface UserInfo {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
}

export interface ExpenseLog {
  id: number;
  expense_id: number;
  action: LogAction;
  remarks?: string | null;
  receipt_url?: string | null;
  created_by?: number | UserInfo | null;
  created_at: string;
}

export interface DivisionOption {
  division_id: number;
  division_name: string;
}

export interface DepartmentOption {
  department_id: number;
  department_name: string;
  division_id?: number | null;
  parent_division?: number | null;
  parentDivision?: number | null;
}

export interface ChartOfAccountOption {
  coa_id: number;
  gl_code?: string | null;
  account_title?: string | null;
  status?: string | null;
}

export interface SupplierOption {
  id: number;
  supplier_name: string;
}

export interface ExpenseFormValues {
  expense_date: string;
  payee: number;
  is_employee: boolean;
  division_id?: number | null;
  department_id?: number | null;
  coa_id: number;
  amount: number;
  remarks?: string;
  receipt_url?: string;
}

export interface BulkExpenseItemValue {
  expense_date: string;
  payee: number;
  is_employee: boolean;
  division_id?: number | null;
  department_id?: number | null;
  coa_id: number;
  amount: number;
  remarks?: string;
  receipt_url?: string;
}

export interface BulkExpenseFormValues {
  items: BulkExpenseItemValue[];
}

export interface ExpenseApproverOption {
  id: number;
  approver_hierarchy: number;
  division_id?: { division_id: number; division_name?: string; division_code?: string } | number | null;
  approver_id?: { user_id: number; user_fname: string; user_lname: string; user_email?: string; user_position?: string } | null;
}

export interface UserDefaultsOption {
  user_id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  division_id: number | null;
  division_name: string | null;
  is_employee: boolean;
  is_salesman?: boolean;
  salesman_id?: number | null;
  salesman_name?: string | null;
  salesman_code?: string | null;
}

