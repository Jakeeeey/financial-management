// utils.ts
// Shared helpers and data-transform functions for the VAT Selling module.

import type {
  RawVATSaleTransaction,
  VATSaleTransaction,
  VATSaleChartPoint,
  VATCustomerEntry,
  VATSaleBarEntry,
  VATSaleMetrics,
} from '../types';

export const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#d946ef',
];

export function formatPeso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Normalise a raw date string to YYYY-MM-DD for display/filtering. */
function parseDate(raw: string | undefined): string {
  if (!raw || raw === '-') return '-';
  // invoiceDate comes as "2025-12-27 17:13:22" — take the date part only
  return raw.split(' ')[0] ?? raw;
}

/** Transform raw API records into typed VATSaleTransaction objects. */
export function transformTransactions(raw: RawVATSaleTransaction[]): VATSaleTransaction[] {
  return raw.map((item) => {
    const rawAmount = Number(item.vat ?? 0);
    return {
      id: item.invoiceNo ?? '-',
      customer: item.customer ?? '-',
      supplier: item.supplier ?? '-',
      amount: formatPeso(rawAmount),
      date: parseDate(item.invoiceDate),
      rawAmount,
    };
  });
}

/** Build time-series chart points from raw transactions. */
export function buildChartPoints(raw: RawVATSaleTransaction[]): VATSaleChartPoint[] {
  return raw.map((item) => ({
    date: parseDate(item.invoiceDate),
    amount: Number(item.vat ?? 0),
  }));
}

/** Build pie / bar customer data from raw transactions. */
export function buildCustomerData(raw: RawVATSaleTransaction[]): {
  pieData: VATCustomerEntry[];
  barData: VATSaleBarEntry[];
} {
  const map: Record<string, number> = {};
  raw.forEach((item) => {
    const name = item.customer ?? '-';
    map[name] = (map[name] ?? 0) + Number(item.vat ?? 0);
  });

  const sorted = Object.entries(map)
    .sort((a, b) => b[1] - a[1]);

  const pieData: VATCustomerEntry[] = sorted.map(([name, value], i) => ({
    name,
    value,
    color: COLORS[i % COLORS.length],
  }));

  const barData: VATSaleBarEntry[] = sorted.map(([name, total]) => ({ name, total }));

  return { pieData, barData };
}

/** Derive summary metrics from raw transactions. */
export function deriveMetrics(raw: RawVATSaleTransaction[]): VATSaleMetrics {
  if (!raw.length) return { totalVat: 0, avgVat: 0, highestVat: 0, count: 0 };
  const amounts = raw.map((t) => Number(t.vat ?? 0));
  const totalVat = amounts.reduce((s, v) => s + v, 0);
  return {
    totalVat,
    avgVat: totalVat / amounts.length,
    highestVat: Math.max(...amounts),
    count: amounts.length,
  };
}

/** Generate pagination page numbers with ellipsis. */
export function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}