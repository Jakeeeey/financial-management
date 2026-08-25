// src/modules/financial-management/treasury/budgeting/user-expense-limit/types.ts

export type MemoStatus = "Available" | "Applied";

export interface UserExpenseLimit {
  id:                 number; // maps to user_id
  user_id:            number;
  user_name?:         string;
  user_email?:        string;
  user_department?:   string;
  user_department_id?: number | null;
  limits:             Record<number, string> | null; // coaId -> limit
  pending_limits:     Record<number, string> | null; // coaId -> pending limit
  created_by_name?:   string;
  updated_by_name?:   string;
  created_at:         string | null;
  updated_at:         string | null;
}

export interface User {
  user_id:              number;
  user_fname:           string | null;
  user_lname:           string | null;
  user_email:           string | null;
  user_department_name?: string | null;
}

export interface Department {
  department_id:   number;
  department_name: string;
}

export interface CreateLimitPayload {
  user_id:       number;
  limits:        Record<number, number>;
  remarks?:      string;
}

export interface UpdateLimitPayload {
  limits:        Record<number, number>;
  remarks?:      string;
}

export interface LimitFilters {
  search:       string;
  department_id: string;
}

export interface Coa {
  coa_id:        number;
  account_title: string;
  gl_code:       string;
}

export interface PendingLimitApproval {
  id:                 number; // user_id
  user_id:            number;
  user_name?:         string;
  user_email?:        string;
  user_department?:   string;
  user_department_id?: number | null;
  limits:             Record<number, string>; // coaId -> limit
  remarks?:           string;
  created_by_name?:   string;
  created_at:         string;
}