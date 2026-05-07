export interface BudgetApprovalFilters {
  search: string;
  year: string;
  month: string;
  division_id: string;
  department_id: string;
  status: "Pending" | "Approved" | "Rejected";
}

// Re-using the Budget interface from budget-creation for consistency with localStorage
export interface Budget {
  id: string;
  parent_budget_id?: string;
  entry_type: 'original' | 'supplemental' | 'realignment';
  year: number;
  month: number;
  division_id: number;
  division_name: string;
  department_id: number;
  department_name: string;
  coa_id: number;
  coa_name: string;
  coa_code: string;
  gl_code: string;
  amount: number;
  remarks: string;
  attachments: { id: string; name: string; url: string; type: string; size: number }[];
  status: "Draft" | "Pending" | "Approved" | "Rejected";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Division {
  division_id: number;
  division_name: string;
  division_code?: string;
  division_description?: string;
}

export interface Department {
  department_id: number;
  department_name: string;
  parent_division?: number;
}
