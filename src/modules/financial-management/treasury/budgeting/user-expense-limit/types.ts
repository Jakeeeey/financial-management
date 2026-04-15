// src/modules/user-expense-limit/types.ts

export type MemoStatus = "Available" | "Applied";

export interface UserExpenseLimit {
  id:           number;
  user_id:      number;
  expense_limit: string;
  created_by:   number | null;
  created_at:   string;
  updated_by:   number | null;
  updated_at:   string;
  user_name?:        string;
  user_email?:       string;
  user_department?:  string;
  user_department_id?: number | null;
  created_by_name?:  string;
  updated_by_name?:  string;
}

export interface User {
  user_id:    number;
  user_fname: string | null;
  user_lname: string | null;
  user_email: string | null;
}

export interface Department {
  department_id:   number;
  department_name: string;
}

export interface CreateLimitPayload {
  user_id:       number;
  expense_limit: number;
}

export interface UpdateLimitPayload {
  expense_limit: number;
}

export interface LimitFilters {
  search:       string;
  department_id: string;
}