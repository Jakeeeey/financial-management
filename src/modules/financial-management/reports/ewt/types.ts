// ewt/types.ts
// All TypeScript interfaces and types for the EWT module.

export interface RawEWTRow {
  // Actual API fields
  invoiceNo?:     string;
  invoiceDate?:   string;
  customer?:      string;
  grossAmount?:   number;
  taxableAmount?: number;
  ewt?:           number | string;
  // Fallback aliases
  id?:            string;
  invoice_number?: string;
  customerName?:  string;
  client?:        string;
  amount?:        number | string;
  date?:          string;
  createdAt?:     string;
  status?:        string;
  [key: string]:  unknown;
}

export interface EWTRecord {
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

export interface EWTMetrics {
  totalAmount:  number;
  averageEwt:   number;
  totalRecords: number;
}