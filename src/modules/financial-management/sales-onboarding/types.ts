// src/modules/financial-management/sales-onboarding/types.ts

export interface Operation {
  id: number;
  operation_name: string;
}

export interface Salesman {
  id: number;
  salesman_code: string;
  salesman_name: string;
  operation?: number | Operation | null;
  price_type?: string;
}

export interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
  payment_term?: number;
}

export interface SalesInvoiceType {
  id: number;
  type: string;
  isOfficial?: number;
}

export interface DiscountType {
  id: number;
  discount_type: string;
  total_percent: number;
}

export interface SalesInvoice {
  invoice_id?: number;
  order_id: string;
  customer_code: string;
  invoice_no: string;
  salesman_id: number;
  invoice_date: string;
  dispatch_date: string;
  due_date: string;
  transaction_status: string;
  payment_status: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  vat_amount?: number | null;
  created_by?: number;
  created_date?: string;
  invoice_type: number;

  // Relations and fields mapped from salesman & customer
  sales_type?: number | null;
  payment_terms?: number | null;
  total_amount?: number | null;
  price_type?: string | null;
  modified_by?: number | null;
  isReceipt?: boolean | null;
}