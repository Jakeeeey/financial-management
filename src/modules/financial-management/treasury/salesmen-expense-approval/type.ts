// src/modules/financial-management/treasury/salesmen-expense-approval/type.ts

export interface SalesmanExpenseRow {
  id: number;
  salesman_name: string;
  salesman_code: string;
  employee_id: number;
  division_id: number | null;
  division_name: string | null;
  draft_count: number;
  rejected_count: number;
}

export interface ExpenseDraftRow {
  id: number;
  encoded_by: number;
  particulars: number;
  particulars_name: string; // from chart_of_accounts.account_title
  transaction_date: string; // YYYY-MM-DD
  amount: number;
  payee: string | null;
  attachment_url: string | null;
  status: "Drafts" | "Approved" | "Rejected";
  drafted_at: string | null;
  rejected_at: string | null;
  approved_at: string | null;
  remarks: string | null;
}

export interface SalesmanUserInfo {
  user_id: number;
  user_fname: string;
  user_mname: string | null;
  user_lname: string;
  user_position: string;
  user_department: number | null;
}

export interface SalesmanDetail {
  id: number;
  salesman_name: string;
  salesman_code: string;
  employee_id: number;
  user: SalesmanUserInfo | null;
  division_id: number | null;
  department_name?: string;
  division_name?: string;
}

export interface SalesmanExpenseDetail {
  salesman: SalesmanDetail;
  expense_limit: number;
  expenses: ExpenseDraftRow[];
}

export interface ConfirmExpensesPayload {
  selected_ids: number[];
  all_ids: number[];
  remarks: string;
  salesman_user_id: number;
  salesman_id: number;
  device_time: string;
  edited_amounts?: Record<number, number>; // Maps expense_id -> new amount
}

export interface ApprovalLog {
  id: number;
  doc_no: string;
  transaction_date: string;
  salesman_name: string;
  total_amount: number;
  remarks: string;
  approver_name: string;
  status: string;
  date_created: string;
}

export interface ApprovalLogDetail {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string;
  date: string;
}
