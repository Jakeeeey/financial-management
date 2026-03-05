// types.ts
// All TypeScript interfaces and types for the EWT module.

export interface RawEWTRow {
  id?: string;
  invoiceNo?: string;
  invoice_number?: string;
  customer?: string;
  customerName?: string;
  client?: string;
  ewt?: number | string;
  amount?: number | string;
  date?: string;
  invoiceDate?: string;
  createdAt?: string;
  status?: string;
  [key: string]: any;
}

export interface EWTRecord {
  id: string;
  customer: string;
  amount: number;
  date: string;
  status: string;
}

export interface AggregatedEntry {
  name: string;
  value: number;
}

export interface EWTMetrics {
  totalAmount: number;
  averageEwt: number;
  totalRecords: number;
}