// types.ts
// All TypeScript interfaces and types for the VAT Selling module.

export interface RawVATSaleTransaction {
  // Actual API fields
  invoiceNo?:    string;
  invoiceDate?:  string;
  customer?:     string;
  supplier?:     string;
  grossAmount?:  number;
  vatExclusive?: number;
  vatAmount?:    number | string;
  // Legacy fallback
  vat?:          number | string;
  [key: string]: any;
}

export interface VATSaleTransaction {
  id:           string;   // invoiceNo
  customer:     string;
  supplier:     string;
  amount:       string;   // formatted vatAmount
  grossAmount:  number;
  vatExclusive: number;
  date:         string;   // invoiceDate (YYYY-MM-DD)
  rawAmount:    number;   // vatAmount as number, for chart use
}

export interface VATSaleChartPoint {
  date:   string;
  amount: number;
}

export interface VATCustomerEntry {
  name:  string;
  value: number;
  color: string;
}

export interface VATSaleBarEntry {
  name:  string;
  total: number;
}

export interface VATSaleMetrics {
  totalVat:   number;
  avgVat:     number;
  highestVat: number;
  count:      number;
}