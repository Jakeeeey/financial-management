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
  transaction_date: string | null;
  date_created: string;
  current_tier: number;
  max_level: number;
  approvers_per_level: Record<number, number>;
  my_vote: { status: string; created_at: string } | null;
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
}

export interface ApproverVote {
  approver_id: number;
  name: string;
  level: number;
  vote: {
    status: string;
    remarks: string | null;
    created_at: string;
  } | null;
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
    transaction_date: string | null;
    date_created: string;
    current_tier: number;
    max_level: number;
  };
  payables: DraftPayable[];
  approvers_by_level: Record<number, ApproverVote[]>;
  my_level: number;
  my_vote: { status: string; remarks: string | null; created_at: string } | null;
  can_vote: boolean;
}

export interface ActivityLog {
  id: number;
  draft_id: number;
  doc_no: string;
  payee_name: string;
  total_amount: number;
  remarks: string | null;
  /** The action the current user took: APPROVED | REJECTED */
  vote_status: string;
  /** The current lifecycle status of the draft: Submitted, Pending_L2, Approved, Rejected, etc. */
  draft_status: string;
  transaction_date: string | null;
  date_created: string;
  last_approver_name: string;
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
}
