// types.ts
// All TypeScript interfaces and types for the VAT Purchases module.

export interface RawVATTransaction {
  // 2705 Actual field names confirmed from Postman
  docNo?: string;
  vat?: number | string;
  documentNo?: string;
  id?: string;
  supplier?: string;
  supplierName?: string;
  vatAmount?: number | string;
  transactionDate?: string;
  date?: string;
  [key: string]: any;
}

export interface VATTransaction {
  id: string;
  supplier: string;
  amount: string; // pre-formatted peso string
  date: string;
  rawAmount: number; // for chart use
}

export interface VATChartPoint {
  date: string;
  amount: number;
}

export interface VATSupplierEntry {
  name: string;
  value: number;
  color: string;
}

export interface VATBarEntry {
  name: string;
  total: number;
}

export interface VATStatCard {
  title: string;
  value: string;
  bg: string;
  accent: string;
  iconName: 'dollar' | 'trending' | 'trending-pink' | 'file';
}

export interface VATMetrics {
  totalVat: number;
  avgVat: number;
  highestVat: number;
  count: number;
}