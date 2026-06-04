export interface ChildInvoice {
  invoice_id: number;
  invoice_no: string;
  total_amount: number;
  invoice_date: string;
  dispatch_date?: string | null;
  transaction_status: string;
}

export interface ServiceInvoiceMappingPayload {
  child_invoice_id: number;
  amount_applied: number;
}

export interface ServiceInvoicePayload {
  invoice_no: string;
  customer_code: string;
  salesman_id: number;
  invoice_type: number;
  invoice_date: string;
  due_date: string;
  dispatch_date?: string | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  sales_type?: number | null;
  price_type?: string | null;
  payment_terms?: number | null;
  remarks?: string | null;
  mappings: ServiceInvoiceMappingPayload[];
}

export interface Salesman {
  id: number;
  salesman_code: string;
  salesman_name: string;
  operation?: number;
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

export interface CustomerSalesmanMapping {
  customer_id: number;
  salesman_id: number;
}

export interface ServiceInvoicingMetadata {
  salesmen: Salesman[];
  customers: Customer[];
  invoiceTypes: SalesInvoiceType[];
  customerSalesmen: CustomerSalesmanMapping[];
}

export interface HistoryChildInvoice {
  mapping_id: number;
  child_invoice_id: number;
  child_invoice_no: string;
  child_total_amount: number;
  child_date: string | null;
  amount_applied: number;
}

export interface ConsolidatedInvoiceHistory {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  due_date?: string;
  dispatch_date?: string | null;
  customer_code: string;
  salesman_id: number;
  invoice_type: number;
  total_amount: number;
  gross_amount?: number;
  discount_amount?: number;
  net_amount?: number;
  transaction_status: string;
  remarks?: string | null;
  children: HistoryChildInvoice[];
}
