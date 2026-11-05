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

export interface ExpenseApprover {
  id: number;
  approver_id: number | UserInfo;
  division_id: number | DivisionInfo;
  approver_hierarchy: number;
  is_deleted?: boolean | number;
  created_by?: number | UserInfo | null;
  created_at?: string | null;
  deleted_by?: number | UserInfo | null;
  deleted_at?: string | null;

  // Joined/flattened fields for convenience
  approver_info?: UserInfo;
  division_info?: DivisionInfo;
}

export type ExpenseStatus =
  | "Draft"
  | "Pending Approval"
  | "Submitted To Disbursement"
  | "With Concern"
  | "Rejected";

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
  has_concern?: boolean;
  created_by?: number | UserInfo | null;
  created_at?: string | null;
}

export interface EncoderGroupSummary {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email?: string;
  division_id?: number | null;
  pending_count: number;
  total_amount: number;
  items: ExpenseItem[];
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

export interface DepartmentOption {
  department_id: number;
  department_name: string;
  division_id?: number;
}

export interface ExpenseApprovalActionPayload {
  expense_id: number;
  action: "Approve" | "With Concern" | "Reject";
  remarks?: string;
  approver_user_id?: number;
  created_at?: string; // Literal PH timestamp
}
