// types.ts
// All TypeScript interfaces and types for the CWT module.

export interface RawCWTRow {
  docNo?: string;
  supplier?: string;
  cwt?: number | string;
  transactionDate?: string;
  [key: string]: any;
}

export interface CWTRecord {
  id: string;            // docNo
  invoiceNo: string;     // docNo
  customerName: string;  // supplier
  invoiceDate: string;   // transactionDate (raw string)
  displayAmount: number; // cwt as number
  dateObj: Date;         // parsed transactionDate for filtering
}

export interface CWTMetrics {
  totalAmount: number;
  totalTransactions: number;
}

export interface PieEntry {
  name: string;
  value: number;
}

export interface TrendEntry {
  month: string;
  amount: number;
}

export interface BarEntry {
  name: string;
  amount: number;
  count: number;
}