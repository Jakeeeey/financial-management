import { BudgetStatus } from "../budget-creation/types";

export type AuditAction = 
  | "Created" 
  | "Submitted" 
  | "Approved" 
  | "Rejected" 
  | "Resubmitted" 
  | "Supplement Requested" 
  | "Deleted";

export interface BudgetAuditTrail {
  id: string;
  budget_id: string;
  action: AuditAction;
  performed_by: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  performed_at: string;
  previous_status?: BudgetStatus;
  new_status: BudgetStatus;
  previous_amount?: number;
  new_amount: number;
  remarks?: string;
  
  // Contextual data for display
  coa_name: string;
  gl_code: string;
  department_name: string;
  division_name: string;
  month: number;
  year: number;
}

export interface AuditTrailFilters {
  search: string;
  action: AuditAction | "";
  user_id: string;
  date_from: string;
  date_to: string;
  division_id: string;
  department_id: string;
}
