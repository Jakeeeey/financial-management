// src/modules/financial-management/treasury/bulk-approval/type.ts

export interface DraftRow {
  id: number;
  doc_no: string;
  payee_user_id: number;
  payee_name: string;
  encoder_name: string;
  total_amount: number;
  remarks: string | null;
  status: string;
  division_name?: string;
  approval_version: number;
  transaction_date: string | null;
  date_created: string;
  current_tier: number;
  max_level: number;
  approvers_per_level: Record<number, number>;
  my_vote: { status: string; created_at: string; version: number } | null;
  can_vote: boolean;
}

export interface DraftPayable {
  id: number;
  coa_id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
  reference_no: string | null;
  attachment_url: string | null;
}

export interface ApproverVote {
  approver_id: number;
  name: string;
  level: number;
  vote: {
    status: string;
    remarks: string | null;
    created_at: string;
    version: number;
  } | null;
}

/** A single vote entry in an approval round */
export interface LogVote {
  approver_id: number;
  name: string;
  /** Approval hierarchy level (1 = first, N = last) */
  level: number;
  status: string; // APPROVED | REJECTED
  remarks: string | null;
  created_at: string;
}

/** All votes in one approval round */
export interface LogRound {
  version: number;
  is_current: boolean;
  /** FINAL_APPROVED | REJECTED | SUPERSEDED | IN_PROGRESS */
  outcome: string;
  votes: LogVote[];
}

/** Draft-centric log record returned by the logs resource */
export interface LogDraft {
  id: number;
  doc_no: string;
  payee_name: string;
  encoder_name: string;
  total_amount: number;
  remarks: string | null;
  status: string;
  approval_version: number;
  transaction_date: string | null;
  date_created: string;
  rounds: LogRound[];
}

/** One round per approvers_by_level tier in the draft-detail response */
export interface VoteRound {
  version: number;
  is_current: boolean;
  outcome: string;
  votes: LogVote[];
}

export interface DraftPayableLog {
  coa_id: number;
  coa_name: string;
  original_amount: number;
  new_amount: number;
  remarks: string | null;
  date: string | null;
  reference_no: string | null;
}

export interface DraftLog {
  id: number;
  editor_name: string;
  edit_reason: string;
  old_total: number;
  new_total: number;
  created_at: string;
  payables: DraftPayableLog[];
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

export interface DraftDetail {
  draft: {
    id: number;
    doc_no: string;
    payee_name: string;
    encoder_name: string;
    total_amount: number;
    remarks: string | null;
    status: string;
    approval_version: number;
    transaction_date: string | null;
    date_created: string;
    current_tier: number;
    max_level: number;
  };
  payables: DraftPayable[];
  approvers_by_level: Record<number, ApproverVote[]>;
  vote_history: VoteRound[];
  logs?: DraftLog[];
  expense_logs?: ExpenseLog[];
  my_level: number;
  my_vote: { status: string; remarks: string | null; created_at: string; version: number } | null;
  can_vote: boolean;
}

export interface ActivityLogDetail {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
}

export interface VotePayload {
  draft_id: number;
  status: "APPROVED" | "REJECTED";
  remarks?: string;
  edited_payables?: {
    id: number;
    amount: string | number;
  }[];
}
