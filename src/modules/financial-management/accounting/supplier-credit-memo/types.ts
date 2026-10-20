import type { SupplierMemo } from "../supplier-memos/types";
// src/modules/financial-management/accounting/supplier-credit-memo/types.ts

export type MemoStatus = "Available" | "Applied" | "USED" | "CANCELLED";

// Matches exact field names returned by Spring /items/suppliers_memo
export type SupplierCreditMemo = SupplierMemo;

export interface Supplier {
  id:                 number;
  supplier_name:      string;
  supplier_shortcut?: string | null;
}

export interface ChartOfAccount {
  coa_id:        number;
  gl_code:       string | null;
  account_title: string | null;
}

export interface CreateMemoPayload {
  supplier_id:      number;
  chart_of_account: number;
  date:             string;
  amount:           number;
  reason?:          string;
  encoder_id?:      number;
}

export interface MemoFilters {
  search:           string;
  supplier_id:      string;
  chart_of_account: string;
  status:           string;
  date_from?:       string;
  date_to?:         string;
}

// Spring wraps list responses in { data: [...] }
export interface SpringListResponse<T> {
  data: T[];
}