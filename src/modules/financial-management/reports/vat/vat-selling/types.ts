// types.ts
// All TypeScript interfaces and types for the VAT Selling module.

export interface RawVATSaleTransaction {
  invoiceNo?: string;
  customer?: string;
  vat?: number | string;
  invoiceDate?: string;
  supplier?: string;
  [key: string]: any;
}

export interface VATSaleTransaction {
  id: string;          // invoiceNo
  customer: string;    // customer
  supplier: string;    // supplier
  amount: string;      // pre-formatted peso string (vat)
  date: string;        // invoiceDate
  rawAmount: number;   // vat as number, for chart use
}

export interface VATSaleChartPoint {
  date: string;
  amount: number;
}

export interface VATCustomerEntry {
  name: string;
  value: number;
  color: string;
}

export interface VATSaleBarEntry {
  name: string;
  total: number;
}

export interface VATSaleMetrics {
  totalVat: number;
  avgVat: number;
  highestVat: number;
  count: number;
}