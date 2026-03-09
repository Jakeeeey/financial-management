// utils/index.ts
// Pure utility functions for the VAT Purchases module — no React, no side effects.

import type {
  RawVATTransaction,
  VATTransaction,
  VATChartPoint,
  VATSupplierEntry,
  VATBarEntry,
  VATMetrics,
} from '../types';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

/** Format a number as Philippine Peso string */
export const formatPeso = (value: number): string =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Extract VAT amount — API now uses vatAmount */
function extractVat(t: RawVATTransaction): number {
  return Number(t.vatAmount ?? t.vat) || 0;
}

/** Extract document/reference number — API now uses remarks */
function extractDocNo(tr: RawVATTransaction, i: number): string {
  return tr.remarks || tr.docNo || tr.documentNo || tr.id || `TR-${i + 1}`;
}

/** Extract transaction date */
function extractDate(t: RawVATTransaction): string {
  return t.transactionDate || t.date || '-';
}

/** Transform raw API transactions into clean VATTransaction objects */
export function transformTransactions(tx: RawVATTransaction[]): VATTransaction[] {
  return tx.map((tr, i) => {
    const rawAmount = extractVat(tr);
    return {
      id:           extractDocNo(tr, i),
      supplier:     tr.supplier || tr.supplierName || '-',
      amount:       rawAmount ? formatPeso(rawAmount) : '-',
      vatExclusive: Number(tr.vatExclusive ?? 0),
      grossAmount:  Number(tr.grossAmount  ?? 0),
      date:         extractDate(tr),
      rawAmount,
    };
  });
}

/** Build line/bar chart data points from raw transactions */
export function buildChartPoints(tx: RawVATTransaction[]): VATChartPoint[] {
  return tx.map((t) => ({
    date:   extractDate(t),
    amount: extractVat(t),
  }));
}

/** Build aggregated supplier pie/bar data from raw transactions */
export function buildSupplierData(tx: RawVATTransaction[]): {
  pieData: VATSupplierEntry[];
  barData: VATBarEntry[];
} {
  const supplierMap: Record<string, number> = {};
  tx.forEach((t) => {
    const supplier = t.supplier || t.supplierName || '-';
    supplierMap[supplier] = (supplierMap[supplier] || 0) + extractVat(t);
  });

  const pieData: VATSupplierEntry[] = Object.entries(supplierMap)
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  const barData: VATBarEntry[] = pieData.map(({ name, value }) => ({ name, total: value }));

  return { pieData, barData };
}

/** Derive VAT metrics from raw transactions */
export function deriveMetrics(tx: RawVATTransaction[]): VATMetrics {
  const totalVat = tx.reduce((sum, t) => sum + extractVat(t), 0);
  return {
    totalVat,
    avgVat:     tx.length ? totalVat / tx.length : 0,
    highestVat: tx.reduce((max, t) => Math.max(max, extractVat(t)), 0),
    count:      tx.length,
  };
}

/** Pagination helper: produce page number + ellipsis array */
export function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (currentPage > 3) pages.push('ellipsis');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export { COLORS };