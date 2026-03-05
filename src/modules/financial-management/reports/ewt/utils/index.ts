// utils/index.ts
// Pure utility functions for the EWT module — no React, no side effects.

import type { RawEWTRow, EWTRecord, AggregatedEntry, EWTMetrics } from '../types';

/** Format a number as Philippine Peso string */
export const formatPeso = (value: number): string =>
  `₱${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** Transform raw API rows into clean EWTRecord objects */
export function transformEWTRows(rows: RawEWTRow[]): EWTRecord[] {
  return rows.map((row, i) => ({
    id: row.id || row.invoiceNo || row.invoice_number || `EWT${i + 1}`,
    customer: row.customer || row.customerName || row.client || 'Unknown',
    amount:
      typeof row.ewt === 'number'
        ? row.ewt
        : parseFloat(
            String(row.ewt || row.amount || '0').replace(/[^0-9.]/g, '')
          ) || 0,
    date: row.date || row.invoiceDate || row.createdAt || '-',
    status: row.status || 'Processed',
  }));
}

/** Aggregate EWT records by customer for charts */
export function aggregateByCustomer(records: EWTRecord[]): AggregatedEntry[] {
  const map: Record<string, number> = {};
  records.forEach((row) => {
    map[row.customer] = (map[row.customer] || 0) + row.amount;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Derive high-level EWT metrics from records */
export function deriveMetrics(records: EWTRecord[]): EWTMetrics {
  const totalAmount = records.reduce((acc, r) => acc + r.amount, 0);
  return {
    totalAmount,
    averageEwt: records.length ? totalAmount / records.length : 0,
    totalRecords: records.length,
  };
}

/** Pagination helper: produce page number + ellipsis array */
export function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (currentPage > 3) pages.push('ellipsis');
  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}