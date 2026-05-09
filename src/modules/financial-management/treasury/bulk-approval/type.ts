// src/modules/financial-management/treasury/bulk-approval/type.ts

export type VoteStatus = "APPROVED" | "REJECTED" | "WITH_CONCERN";

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
  my_vote: {
    status: string;
    created_at: string;
    version: number;
  } | null;
  can_vote: boolean;
  has_concern?: boolean;
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
  is_concern?: boolean;
  is_rejected?: boolean;
  feedback?: string | null;
}

export interface ConcernItem {
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
}

export interface LogVote {
  approver_id: number;
  name: string;
  level: number;
  status: string;
  remarks: string | null;
  created_at: string;
}

export interface LogRound {
  version: number;
  is_current: boolean;
  outcome: string;
  votes: LogVote[];
}

export interface DraftDetail {
  draft: DraftRow;
  payables: DraftPayable[];
  concern_items?: ConcernItem[];
  vote_history?: LogRound[];
  approvers_by_level?: Record<number, LogVote[]>;
  my_level?: number;
  my_vote?: {
    status: string;
    created_at: string;
    version: number;
  } | null;
  can_vote?: boolean;
}

export interface LogDraft {
  id: number;
  doc_no: string;
  payee_user_id: number;
  payee_name: string;
  encoder_name: string;
  total_amount: number;
  remarks: string | null;
  status: string;
  division_name: string;
  approval_version: number;
  transaction_date: string | null;
  date_created: string;
  rounds: LogRound[];
}

export interface ActivityLogDetail {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
}

export interface ItemDecision {
  status: VoteStatus;
  remarks: string;
}

export interface VotePayload {
  draft_id: number;
  status: VoteStatus;
  remarks?: string;
  edited_payables?: {
    id: number;
    amount: string | number;
  }[];
  item_decisions?: Record<number, ItemDecision>;
}
