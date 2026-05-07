// src/modules/financial-management/treasury/budgeting/create-budget/types.ts

export type BudgetStatus = "Draft" | "Pending" | "Approved" | "Rejected";

export interface Budget {
  id: string;
  parent_budget_id?: string | null;
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
  attachments: BudgetAttachment[];
  status: BudgetStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
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

export interface DepartmentPerDivision {
  id: number;
  division_id: number;
  department_id: number;
  department_name?: string; // Often joined
  division_name?: string;   // Often joined
}

export interface DepartmentDivisionCOA {
  id: number;
  dept_div_id: number;
  coa_id: number;
  coa_name?: string; // Often joined
  coa_code?: string; // Often joined
}

export interface COA {
  coa_id: number;
  coa_name: string;
  coa_code: string;
}

export interface CreateBudgetPayload {
  parent_budget_id?: string | null;
  entry_type: 'original' | 'supplemental' | 'realignment';
  year: number;
  month: number;
  division_id: number;
  department_id: number;
  dept_div_coa_id: number; // Based on the junction needed
  gl_code: string;
  amount: number;
  remarks: string;
  attachments: File[];
}

export interface BudgetFilters {
  search: string;
  year: string;
  month: string;
  division_id: string;
  department_id: string;
  status: BudgetStatus;
}
