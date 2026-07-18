// src/modules/financial-management/treasury/bulk-approval/services/bulkApproval.types.ts

export type VoteStatus = "APPROVED" | "REJECTED" | "WITH_CONCERN";
export type DraftLifecycleStatus =
  | "Submitted"
  | `Pending_L${number}`
  | "With Concern"
  | "Rejected"
  | "Approved";

export type DirectusListResponse<T> = {
  data?: T[];
};

export type DirectusItemResponse<T> = {
  data?: T;
};

export type DirectusAggregateCountResponse = {
  data?: {
    count?: string | number;
  }[];
};

export type DirectusUserRow = {
  user_id?: number | string;
  user_fname?: string | null;
  user_mname?: string | null;
  user_lname?: string | null;
  suffix_name?: string | null;
  nickname?: string | null;
  user_email?: string | null;
};

export type DirectusSupplierRow = {
  id?: number | string;
  user_id?: number | string | null;
  division_id?: number | string | null;
  supplier_name?: string | null;
  supplier_shortcut?: string | null;
  contact_person?: string | null;
  email_address?: string | null;
  phone_number?: string | null;
  isActive?: number | string | boolean | null;
};

export type DirectusDivisionRow = {
  division_id?: number | string;
  division_name?: string | null;
  division_description?: string | null;
  division_code?: string | null;
};

export type DirectusCoaRow = {
  coa_id?: number | string;
  gl_code?: string | null;
  account_title?: string | null;
};

export type ApproverRecord = {
  id: number;
  approver_id: number;
  division_id: number;
  division_name?: string | null;
  approver_heirarchy: number;
};

export type DirectusApproverRow = {
  id?: number | string;
  approver_id?: number | string | DirectusUserRow | null;
  division_id?: number | string | DirectusDivisionRow | null;
  approver_heirarchy?: number | string | null;
};

export type DisbursementDraftRow = {
  id: number | string;
  doc_no?: string | null;
  payee?: number | string | DirectusSupplierRow | null;
  total_amount?: number | string | null;
  remarks?: string | null;
  status?: string | null;
  approval_version?: number | string | null;
  version?: number | string | null;
  transaction_date?: string | null;
  division_id?: number | string | DirectusDivisionRow | null;
  department_id?: number | string | null;
  encoder_id?: number | string | DirectusUserRow | null;
  transaction_type?: number | string | null;
  supporting_documents_url?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  is_supervisor?: number | string | null;
};

export type DisbursementPayableDraftRow = {
  id: number | string;
  disbursement_id?: number | string | null;
  division_id?: number | string | null;
  coa_id?: number | string | DirectusCoaRow | null;
  amount?: number | string | null;
  reference_no?: string | null;
  remarks?: string | null;
  date?: string | null;
  expense_id?:
  | number
  | string
  | {
    id?: number | string;
    status?: string | null;
    feedback?: string | null;
    header_id?: number | string | null;
    amount?: number | string | null;
    attachment_url?: string | number | { id?: string; uuid?: string; directus_files_id?: string } | null;
  }
  | null;
};

export type ExpenseDraftRow = {
  id: number | string;
  amount?: number | string | null;
  remarks?: string | null;
  transaction_date?: string | null;
  division_id?: number | string | null;
  encoded_by?: number | string | null;
  payee?: string | null;
  return_to?: string | null;
  particulars?: number | string | DirectusCoaRow | null;
  attachment_url?: string | number | { id?: string; uuid?: string; directus_files_id?: string } | null;
  feedback?: string | null;
  status?: string | null;
  header_id?: number | string | null;
  is_supervisor?: number | string | null;
};

export type ApprovalVoteRow = {
  id?: number | string;
  draft_id?: number | string | null;
  approver_id?: number | string | DirectusUserRow | null;
  status?: string | null;
  remarks?: string | null;
  version?: number | string | null;
  created_at?: string | null;
};

export type DraftRowResponse = {
  id: number;
  doc_no: string;
  payee_user_id: number;
  payee_name: string;
  encoder_user_id?: number;
  encoder_name: string;
  total_amount: number;
  remarks: string | null;
  status: string;
  division_id: number;
  division_name?: string;
  requires_final_top_sheet?: boolean;
  approval_version: number;
  transaction_date: string | null;
  date_created: string;
  current_tier: number;
  max_level: number;
  approvers_per_level: Record<number, number>;
  my_vote: {
    status: string;
    created_at: string;
    version: number;
  } | null;
  can_vote: boolean;
  has_concern?: boolean;
};

export type PayableResponse = {
  id: number;
  coa_id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
  reference_no: string | null;
  attachment_url: string | null;
  is_concern?: boolean;
  is_rejected?: boolean;
  feedback?: string | null;
  expense_id?: number;
};

export type ConcernItemResponse = {
  expense_id: number;
  status: string;
  feedback: string | null;
  return_to: string | null;
  amount: number;
  coa_id: number;
  coa_name: string;
  remarks: string | null;
  transaction_date: string | null;
  attachment_url: string | null;
  reference_no?: string | null;
};

export type LogVoteResponse = {
  approver_id: number;
  name: string;
  level: number;
  status: string;
  remarks: string | null;
  created_at: string;
};

export type LogRoundResponse = {
  version: number;
  is_current: boolean;
  outcome: string;
  votes: LogVoteResponse[];
};

export type ActivityLogDetailResponse = {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
};

export type DraftRevisionLogResponse = {
  id: number;
  payable_draft_id: number;
  coa_name: string | null;
  editor_name: string;
  original_amount: number | null;
  new_amount: number | null;
  amount: number;
  remarks: string | null;
  version: number;
  created_at: string;
};

export type ExpenseRevisionLogResponse = {
  log_id: number;
  expense_id: number;
  action: string;
  editor_name: string;
  changed_at: string;
  amount: number;
  remarks: string | null;
  particulars: string | null;
  status: string;
  version: number;
};

export type DisbursementPayableDraftLogRow = {
  id?: number | string;
  log_id?: number | string | null;
  payable_draft_id?: number | string | null;
  disbursement_id?: number | string | null;
  coa_id?: number | string | DirectusCoaRow | null;
  reference_no?: string | null;
  amount?: number | string | null;
  original_amount?: number | string | null;
  new_amount?: number | string | null;
  remarks?: string | null;
  date?: string | null;
  version?: number | string | null;
  updated_by?: number | string | DirectusUserRow | null;
  log_date?: string | null;
};

export type ExpenseDraftLogRow = {
  log_id?: number | string;
  expense_id?: number | string | null;
  action?: string | null;
  changed_by?: number | string | DirectusUserRow | null;
  changed_at?: string | null;
  amount?: number | string | null;
  remarks?: string | null;
  particulars?: number | string | DirectusCoaRow | null;
  status?: string | null;
  version?: number | string | null;
};

export type ExpenseDraftHeaderRow = {
  id?: number | string;
  division_id?: number | string | DirectusDivisionRow | null;
  period_from?: string | null;
  period_to?: string | null;
  created_by?: number | string | DirectusUserRow | null;
  created_at?: string | null;
};

export type DirectusSalesmanRow = {
  id?: number | string;
  employee_id?: number | string | null;
  salesman_code?: string | null;
  salesman_name?: string | null;
};

export type ApprovalContextResponse = {
  division_id: number;
  division_name: string | null;
  approver_level: number;
  is_final_approver: boolean;
};

export type FinalHeaderGroupResponse = {
  group_key: string;
  division_id: number;
  division_name: string | null;
  period_from: string;
  period_to: string;
  header_id: number;
  header_count: number;
  salesman_count: number;
  coa_count: number;
  expense_count: number;
  total_amount: number;
  is_final_ready: boolean;
  draft_ids?: number[];
  draft_statuses?: string[];
  can_act?: boolean;
  is_waiting?: boolean;
  current_tier?: number;
  required_approver_level?: number;
  current_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  next_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  previous_tier_approver_names?: string[];
};

export type FinalTopSheetSalesmanResponse = {
  employee_id: number;
  salesman_id: number | null;
  salesman_code: string | null;
  salesman_name: string;
  total_amount: number;
  current_tier?: number;
  current_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  next_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  previous_tier_approver_names?: string[];
  draft_statuses?: string[];
  header_id?: number;
};

export type FinalTopSheetCellResponse = {
  employee_id: number;
  header_id?: number;
  amount: number;
  count: number;
  expense_ids: number[];
};

export type FinalTopSheetCoaRowResponse = {
  coa_id: number;
  account_title: string;
  gl_code: string | null;
  row_total: number;
  cells: FinalTopSheetCellResponse[];
};

export type FinalTopSheetDetailResponse = {
  expense_id: number;
  header_id: number;
  employee_id: number;
  salesman_name: string;
  coa_id: number;
  account_title: string;
  transaction_date: string;
  amount: number;
  payee: string | null;
  remarks: string | null;
  status: string;
  attachment_url: string | null;
  draft_tier?: number;
};

export type FinalTopSheetGroupMetaResponse = {
  division_id: number;
  division_name: string | null;
  period_from: string;
  period_to: string;
  header_count: number;
  total_amount: number;
  draft_statuses?: string[];
  can_act?: boolean;
  is_waiting?: boolean;
  current_tier?: number;
  required_approver_level?: number;
  current_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  next_tier_approvers?: { approver_id: number; name: string; voted: boolean }[];
  previous_tier_approver_names?: string[];
};

export type FinalHeaderDecisionStatus = "Approved" | "Rejected" | "With Concern";

export type FinalHeaderDecisionBody = {
  resource: "final-header-decision";
  division_id: number;
  period_from: string;
  period_to: string;
  status: FinalHeaderDecisionStatus;
  remarks?: string;
  target_scope: "all" | "encoder" | "coa" | "cell" | "expense_ids";
  employee_id?: number;
  coa_id?: number;
  expense_ids?: number[];
  concern_expense_ids?: number[]; // Legacy field, keeping for compatibility
  header_id?: number;
};




export type ItemDecision = {
  status: VoteStatus;
  remarks: string;
};

export type PostBody = {
  draft_id: number;
  status: VoteStatus;
  remarks?: string;
  edited_payables?: {
    id: number;
    amount: string | number;
  }[];
  item_decisions?: Record<string, ItemDecision>;
};

export type DirectusResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
};

export type BulkApprovalContext = {
  currentUserId: number;
  approverRecords: ApproverRecord[];
  myDivisionIds: number[];
  levelsByDivision: Record<number, number[]>;
  myLevel: number;
  allApprovers: ApproverRecord[];
  maxLevelByDivision: Record<number, number>;
  approversPerLevelByDivision: Record<number, Record<number, number>>;
};

export type AuthContextResult =
  | { ok: true; context: BulkApprovalContext }
  | { ok: false; status: number; body: { error: string; message?: string } };
