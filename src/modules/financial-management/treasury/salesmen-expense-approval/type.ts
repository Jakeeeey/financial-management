// src/modules/financial-management/treasury/salesmen-expense-approval/type.ts

export interface DirectusUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
}

export interface DirectusSupplier {
  id: number;
  supplier_name: string;
}

export interface DirectusDivision {
  id: number;
  name: string;
}

export interface DirectusCOA {
  coa_id: number;
  account_title: string;
}

export interface DirectusDisbursementDraft {
  id: number;
  doc_no: string;
  payee: number;
  total_amount: number;
  remarks: string;
  status: string;
  approval_version: number;
  transaction_date: string;
  division_id: number;
  transaction_type: number;
  encoder_id: number;
  approver_id: number | null;
  date_created: string;
}

export interface DirectusDisbursementPayableDraft {
  id: number;
  disbursement_id: number;
  division_id: number;
  reference_no: string;
  coa_id: number;
  amount: number;
  remarks: string;
  date: string;
  expense_id?: number | { attachment_url?: string; attatchment_url?: string };
}

export interface DirectusDisbursementDraftApprover {
  id: number;
  approver_id: number;
  division_id: number;
  approver_heirarchy: number;
}

export interface DirectusDisbursementDraftApproval {
  id: number;
  draft_id: number;
  approver_id: number;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  remarks: string | null;
  version: number;
  created_at: string;
}

export interface DirectusDisbursementDraftLog {
  log_id: number;
  editor_id: number;
  edit_reason: string;
  payload_snapshot: string;
  created_at: string;
}

export interface DirectusDisbursementPayableDraftLog {
  id: number;
  log_id: number;
  coa_id: number;
  original_amount: number;
  new_amount: number;
  remarks: string;
  date: string;
  reference_no: string;
}

export interface DirectusExpenseDraft {
  id: number;
  attachment_url: string | null;
  attatchment_url: string | null;
}

export interface DirectusExpenseDraftLog {
  log_id: number;
  expense_id: number;
  action: string;
  changed_by: number;
  changed_at: string;
  amount: number;
  remarks: string | null;
  particulars: number;
  status: string;
  attachment_url?: string;
  attatchment_url?: string;
}

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
  payee_id: number | null;
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

export interface TreasuryVote {
  approver_name: string;
  status: string;
  remarks: string | null;
  version: number;
  created_at: string;
}

export interface DraftLog {
  id: number;
  editor_name: string;
  edit_reason: string;
  old_total: number;
  new_total: number;
  created_at: string;
  payables?: ApprovalLogDetail[]; // For now, we only need the variance
}

export interface ExpenseLog {
  id: number;
  expense_id: number;
  action: string;
  editor_name: string;
  changed_at: string;
  amount: number;
  remarks: string | null;
  particulars: string;
  status: string;
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
  votes?: TreasuryVote[];
  logs?: DraftLog[];
  expense_logs?: ExpenseLog[];
}

export interface ApprovalLogDetail {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string;
  date: string;
}
