// utils/index.ts
// Pure utility functions — no React, no side effects.

import type { RawInvoiceRow, Invoice, AgingBucket, NamedAmount, ARMetrics } from '../types';

/** Format a number as Philippine Peso string */
export const formatPeso = (v: number): string =>
  `₱${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** Format a date string to a readable short date */
export const formatDate = (d?: string): string => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Transform raw API rows into clean Invoice objects and side-effect maps */
export function transformInvoices(data: RawInvoiceRow[]): {
  invoices: Invoice[];
  agingData: AgingBucket[];
  branchMap: Record<string, number>;
  salesmanMap: Record<string, number>;
} {
  const agingData: AgingBucket[] = [
    { range: '0-30 Days', amount: 0 },
    { range: '30-60 Days', amount: 0 },
    { range: '60+ Days', amount: 0 },
  ];
  const branchMap: Record<string, number> = {};
  const salesmanMap: Record<string, number> = {};

  const invoices: Invoice[] = data.map((row) => {
    // ✅ Use actual API field names, fallback to aliases
    // ✅ Coerce to number to prevent arithmetic errors on unknown properties
    const netReceivable = Number(row.netReceivable ?? row.total ?? row.amount ?? 0);
    const totalPaid = Number(row.totalPaid ?? row.paid ?? row.amountPaid ?? 0);
    const outstanding = Number(row.outstandingBalance ?? row.outstanding ?? (netReceivable - totalPaid));
    const overdue = Number(row.daysOverdue ?? 0) || null;
    const branch = String(row.branch ?? row.branchName ?? 'Unknown');
    const salesman = String(row.salesman ?? row.salesmanName ?? 'Unknown');
    const due = String(row.calculatedDueDate ?? row.dueDate ?? row.due ?? '');

    const status: Invoice['status'] =
      outstanding === 0 ? 'Paid'
        : overdue !== null && overdue > 0 ? 'Overdue'
          : 'Due';

    // Aging buckets
    if (overdue !== null) {
      if (overdue <= 30) agingData[0].amount += outstanding;
      else if (overdue <= 60) agingData[1].amount += outstanding;
      else agingData[2].amount += outstanding;
    }

    branchMap[branch] = (branchMap[branch] || 0) + outstanding;
    salesmanMap[salesman] = (salesmanMap[salesman] || 0) + outstanding;

    return {
      id: String(row.invoiceId ?? row.id ?? row.invoiceNo ?? ''),
      invoiceNo: row.invoiceNo ?? row.invoice_number ?? '—',
      orderId: row.orderId ?? '—',
      customer: row.customerName ?? row.customer ?? row.client ?? '—',
      customerCode: row.customerCode ?? '—',
      invoiceDate: row.invoiceDate ?? '',
      due,
      netReceivable,
      totalPaid,
      outstanding,
      overdue,
      branch,
      salesman,
      status,
    };
  });

  return { invoices, agingData, branchMap, salesmanMap };
}

/** Derive high-level AR metrics from invoice list */
export function deriveMetrics(
  invoices: Invoice[],
  branchMap: Record<string, number>
): ARMetrics {
  const totalReceivable = invoices.reduce((sum, inv) => sum + inv.netReceivable, 0);
  const totalOutstanding = Object.values(branchMap).reduce((sum, v) => sum + v, 0);
  const overdueInvoices = invoices.filter((inv) => inv.status === 'Overdue');
  const avgOverdue =
    overdueInvoices.length > 0
      ? Math.round(overdueInvoices.reduce((sum, inv) => sum + (inv.overdue || 0), 0) / overdueInvoices.length)
      : 0;

  return { totalReceivable, totalOutstanding, overdueInvoices, avgOverdue };
}

/** Convert a map to a sorted NamedAmount array, sliced to limit */
export function mapToSortedArray(map: Record<string, number>, limit = 8): NamedAmount[] {
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
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