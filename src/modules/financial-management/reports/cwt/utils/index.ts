// utils/index.ts
// Pure utility functions for the CWT module — no React, no side effects.

import type { RawCWTRow, CWTRecord, AggregatedEntry, CWTMetrics } from '../types';

/** Format a number as Philippine Peso string */
export const formatPeso = (value: number): string =>
  `₱${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** Transform raw API rows into clean CWTRecord objects */
export function transformCWTRows(rows: RawCWTRow[]): CWTRecord[] {
  return rows.map((row, i) => {
    // Strip time component from date — API returns "2025-12-26 17:52:45"
    const rawDate = row.transactionDate ?? row.invoiceDate ?? row.date ?? row.createdAt ?? '-';
    const date    = rawDate !== '-' ? rawDate.split(' ')[0] : '-';

    return {
      id:            row.docNo ?? row.invoiceNo ?? row.invoice_number ?? row.id ?? `CWT${i + 1}`,
      customer:      row.supplier ?? row.customer ?? row.customerName ?? row.client ?? 'Unknown',
      amount:        typeof row.ewt === 'number'
        ? row.ewt
        : parseFloat(String(row.ewt ?? row.amount ?? '0').replace(/[^0-9.]/g, '')) || 0,
      grossAmount:   Number(row.grossAmount   ?? 0),
      taxableAmount: Number(row.taxableAmount ?? 0),
      date,
      status:        row.status ?? 'Processed',
    };
  });
}

/** Aggregate CWT records by customer for charts */
export function aggregateByCustomer(records: CWTRecord[]): AggregatedEntry[] {
  const map: Record<string, number> = {};
  records.forEach((r) => {
    map[r.customer] = (map[r.customer] || 0) + r.amount;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Derive high-level CWT metrics from records */
export function deriveMetrics(records: CWTRecord[]): CWTMetrics {
  const totalAmount = records.reduce((acc, r) => acc + r.amount, 0);
  return {
    totalAmount,
    averageCwt:   records.length ? totalAmount / records.length : 0,
    totalRecords: records.length,
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