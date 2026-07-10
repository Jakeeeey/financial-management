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

/** Match vos_database.expense_draft */
export interface ExpenseDraft {
  id: number;
  header_id: number;
  encoded_by: number;
  particulars: number;
  division_id: number;
  payee_id: number | null;
  encoded_date: string | null;
  transaction_date: string;
  amount: number;
  payee: string | null;
  attachment_url: string | null;
  status: "Drafts" | "Approved" | "Rejected" | "With Concern";
  drafted_at: string | null;
  rejected_at: string | null;
  approved_at: string | null;
  remarks: string | null;
  version: number;
  feedback: string | null;
  return_to: string | null;
  is_supervisor?: number | null;
}

/** Match vos_database.disbursement_draft */
export interface DisbursementDraft {
  id: number;
  doc_no: string;
  transaction_type: number | null;
  payee: number | null;
  remarks: string | null;
  total_amount: number;
  paid_amount: number;
  encoder_id: number;
  approver_id: number | null;
  posted_by: number | null;
  date_updated: string;
  date_created: string;
  isPosted: number;
  transaction_date: string | null;
  date_approved: string | null;
  date_posted: string | null;
  division_id: number | null;
  department_id: number | null;
  fund_source_id: number | null;
  supporting_documents_url: string | null;
  status: string;
  version: number;
  approval_version: number;
}

/** Match vos_database.disbursement_payables_draft */
export interface DisbursementPayableDraft {
  id: number;
  disbursement_id: number | null;
  expense_id: number | null;
  division_id: number | null;
  reference_no: string | null;
  date: string | null;
  coa_id: number | null;
  amount: number;
  remarks: string | null;
  version: number;
  date_created: string | null;
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
  concern_count: number;
  pending_amount: number;
  header_count: number;
}

export interface ExpenseDraftRow {
  id: number;
  header_id: number;
  encoded_by: number;
  particulars: number;
  particulars_name: string;
  transaction_date: string;
  amount: number;
  payee: string | null;
  payee_id: number | null;
  attachment_url: string | null;
  status: "Drafts" | "Approved" | "Rejected" | "With Concern";
  drafted_at: string | null;
  rejected_at: string | null;
  approved_at: string | null;
  remarks: string | null;
  version: number;
  feedback: string | null;
  is_supervisor?: number | null;
}

export interface ExpenseHeader {
  id: number;
  period_from: string;
  period_to: string;
  remarks: string | null;
  status: string;
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
  headers: ExpenseHeader[];
}

export interface ItemDecision {
  status: "Approved" | "Rejected" | "With Concern";
  remarks: string;
}

export interface BatchApprovalPayload {
  salesman_id: number;
  remarks: string;
  item_decisions: Record<number, ItemDecision>;
  edited_amounts?: { id: number; amount: number }[];
  all_ids?: number[];
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
}

export interface ExpenseLog {
  log_id: number;
  expense_id: number;
  action: string;
  editor_name: string;
  changed_at: string;
  amount: number;
  remarks: string | null;
  particulars: string;
  status: string;
  version: number;
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
