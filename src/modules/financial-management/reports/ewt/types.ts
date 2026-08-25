// types.ts
// All TypeScript interfaces and types for the EWT module.

export interface RawEWTRow {
  docNo?:           string;
  supplier?:        string;
  cwt?:             number | string;
  transactionDate?: string;
  grossAmount?:     number;
  taxableAmount?:   number;
  [key: string]: unknown;
}

export interface EWTRecord {
  id:            string;  // docNo
  invoiceNo:     string;  // docNo
  customerName:  string;  // supplier
  invoiceDate:   string;  // transactionDate (raw string)
  grossAmount:   number;
  taxableAmount: number;
  displayAmount: number;  // EWT as number
  dateObj:       Date;    // parsed transactionDate for filtering
}

export interface EWTMetrics {
  totalAmount:       number;
  totalTransactions: number;
}

export interface PieEntry {
  name:  string;
  value: number;
}

export interface TrendEntry {
  month:  string;
  amount: number;
}

export interface BarEntry {
  name:   string;
  amount: number;
  count:  number;
}