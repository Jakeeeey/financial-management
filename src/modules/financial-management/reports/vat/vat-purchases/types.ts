// types.ts
// All TypeScript interfaces and types for the VAT Purchases module.

export interface RawVATTransaction {
  // Actual API fields
  remarks?:         string;
  transactionDate?: string;
  supplier?:        string;
  vatExclusive?:    number;
  grossAmount?:     number;
  vatAmount?:       number | string;
  // Legacy fallbacks
  docNo?:           string;
  vat?:             number | string;
  documentNo?:      string;
  id?:              string;
  supplierName?:    string;
  date?:            string;
  [key: string]:    any;
}

export interface VATTransaction {
  id:           string;  // remarks / docNo
  supplier:     string;
  amount:       string;  // formatted vatAmount
  vatExclusive: number;
  grossAmount:  number;
  date:         string;
  rawAmount:    number;  // for chart use
}

export interface VATChartPoint {
  date:   string;
  amount: number;
}

export interface VATSupplierEntry {
  name:  string;
  value: number;
  color: string;
}

export interface VATBarEntry {
  name:  string;
  total: number;
}

export interface VATStatCard {
  title:    string;
  value:    string;
  bg:       string;
  accent:   string;
  iconName: 'dollar' | 'trending' | 'trending-pink' | 'file';
}

export interface VATMetrics {
  totalVat:   number;
  avgVat:     number;
  highestVat: number;
  count:      number;
}