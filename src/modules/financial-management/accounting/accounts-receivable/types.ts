// types.ts
// All TypeScript interfaces and types for the Accounts Receivable module.

export interface RawInvoiceRow {
  // ✅ Actual field names confirmed from API response
  invoiceId?: number;
  invoiceNo?: string;
  orderId?: string;
  customerName?: string;
  customerCode?: string;
  invoiceDate?: string;
  calculatedDueDate?: string;
  netReceivable?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  daysOverdue?: number;
  branch?: string;
  salesman?: string;
  division?: string;
  isPosted?: number;
  grossAmount?: number;
  discountAmount?: number;
  returnAmount?: number;
  unfulfilledAmount?: number;
  appliedCreditMemos?: number;
  appliedDebitMemos?: number;
  salesType?: number | null;       // FK → operation.id
  // Fallback aliases
  id?: string;
  invoice_number?: string;
  customer?: string;
  client?: string;
  branchName?: string;
  salesmanName?: string;
  [key: string]: unknown;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  orderId: string;
  customer: string;
  customerCode: string;
  invoiceDate: string;
  due: string;
  netReceivable: number;
  totalPaid: number;
  outstanding: number;
  overdue: number | null;
  branch: string;
  salesman: string;
  division: string;
  status: 'Paid' | 'Overdue' | 'Due';
  grossAmount: number;
  discountAmount: number;
  returnAmount: number;
  unfulfilledAmount: number;
  appliedCreditMemos: number;
  appliedDebitMemos: number;
  isPosted: boolean;
  salesType: number | null;          // FK → operation.id
}

export interface AgingBucket {
  range: string;
  amount: number;
}

export interface NamedAmount {
  name: string;
  amount: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface ARMetrics {
  totalReceivable: number;
  totalOutstanding: number;
  overdueInvoices: Invoice[];
  avgOverdue: number;
}

export interface OperationBreakdown {
  id: number | null;
  name: string;
  code: string | null;
  totalOutstanding: number;
  count: number;
}

export interface ARApiResponse {
  rows: RawInvoiceRow[];
  operationData: OperationBreakdown[];
}