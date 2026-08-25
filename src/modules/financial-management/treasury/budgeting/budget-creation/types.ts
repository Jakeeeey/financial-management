// src/modules/financial-management/treasury/budgeting/create-budget/types.ts

import { 
  Budget, 
  BudgetStatus, 
  BudgetAttachment, 
  Division, 
  Department, 
  COA, 
  CreateBudgetPayload,
  BudgetAuditTrail
} from "./schemas";

export type { 
  Budget, 
  BudgetStatus, 
  BudgetAttachment, 
  Division, 
  Department, 
  COA, 
  CreateBudgetPayload,
  BudgetAuditTrail
};

export interface DepartmentPerDivision {
  id: number;
  division_id: number;
  department_id: number;
  department_name?: string; 
  division_name?: string;   
}

export interface DepartmentDivisionCOA {
  id: number;
  dept_div_id: number;
  coa_id: number;
  coa_name?: string; 
  coa_code?: string; 
}

export interface BudgetFilters {
  search: string;
  year: string;
  month: string;
  division_id: string;
  department_id: string;
  status: BudgetStatus;
}

export interface AuditTrailFilters {
  action?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
}
