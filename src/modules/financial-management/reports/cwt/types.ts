// cwt/types.ts
// All TypeScript interfaces and types for the CWT module.

export interface RawCWTRow {
  // EWT API fields (this module reads from EWT endpoint)
  docNo?:           string;
  supplier?:        string;
  ewt?:             number | string;
  transactionDate?: string;
  grossAmount?:     number;
  taxableAmount?:   number;
  // Fallback aliases
  invoiceNo?:       string;
  invoiceDate?:     string;
  customer?:        string;
  id?:              string;
  invoice_number?:  string;
  customerName?:    string;
  client?:          string;
  amount?:          number | string;
  date?:            string;
  createdAt?:       string;
  status?:          string;
  [key: string]:    unknown;
}

export interface CWTRecord {
  id:            string;
  customer:      string;
  amount:        number;
  grossAmount:   number;
  taxableAmount: number;
  date:          string;
  status:        string;
}

export interface AggregatedEntry {
  name:  string;
  value: number;
}

export interface CWTMetrics {
  totalAmount:  number;
  averageCwt:   number;
  totalRecords: number;
}