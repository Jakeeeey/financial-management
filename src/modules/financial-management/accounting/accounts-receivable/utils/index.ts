// utils/index.ts
// Pure utility functions — no React, no side effects.

import type { RawInvoiceRow, Invoice, AgingBucket, NamedAmount, ARMetrics } from '../types';

export const formatPeso = (v: number): string =>
  `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (d?: string): string => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Computes how many days overdue an invoice is based on its due date.
 *
 * Returns:
 *   null     → no valid due date; cannot determine overdue state
 *   negative → due in the future; not yet overdue
 *   0        → due exactly today; overdue (0 days aged)
 *   positive → past due; N days overdue
 *
 * Uses Math.floor so same-day always yields 0, never 1.
 */
function computeAgingDays(dueDateStr: string): number | null {
  if (!dueDateStr || dueDateStr === '—') return null;

  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return null; // unparseable date string

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function transformInvoices(data: RawInvoiceRow[]): {
  invoices: Invoice[];
  agingData: AgingBucket[];
  branchMap: Record<string, number>;
  salesmanMap: Record<string, number>;
} {
  const agingData: AgingBucket[] = [
    { range: '0-30 Days',  amount: 0 },
    { range: '30-60 Days', amount: 0 },
    { range: '60+ Days',   amount: 0 },
  ];
  const branchMap:   Record<string, number> = {};
  const salesmanMap: Record<string, number> = {};

  const invoices: Invoice[] = data.map((row) => {
    const netReceivable = Number(row.netReceivable ?? row.grossAmount ?? row.total ?? row.amount ?? 0);
    const totalPaid     = Number(row.totalPaid ?? row.paid ?? row.amountPaid ?? 0);
    const outstanding   = Number(row.outstandingBalance ?? row.outstanding ?? (netReceivable - totalPaid));
    const branch        = String(row.branch   ?? row.branchName   ?? 'Unknown');
    const salesman      = String(row.salesman ?? row.salesmanName ?? 'Unknown');
    const division      = String(row.division ?? '—');
    const due           = String(row.calculatedDueDate ?? row.dueDate ?? row.due ?? '');

    // aging: null = no due date, negative = future, 0 = due today, positive = past due
    const aging = computeAgingDays(due);

    // Only overdue when:
    //   1. We have a valid due date (aging !== null)
    //   2. Due date is today or in the past (aging >= 0)
    //   3. There is still an outstanding balance
    const isOverdue = aging !== null && aging >= 0 && outstanding > 0;

    const status: Invoice['status'] =
      outstanding === 0 ? 'Paid'
      : isOverdue       ? 'Overdue'
      : 'Due';

    // Only bucket records that are actually overdue (aging >= 0)
    // Skip null (no due date) and negative (future — not yet overdue)
    if (aging !== null && aging >= 0 && outstanding > 0) {
      if      (aging <= 30) agingData[0].amount += outstanding;
      else if (aging <= 60) agingData[1].amount += outstanding;
      else                  agingData[2].amount += outstanding;
    }

    branchMap[branch]     = (branchMap[branch]     || 0) + outstanding;
    salesmanMap[salesman] = (salesmanMap[salesman] || 0) + outstanding;

    return {
      id:           String(row.invoiceId ?? row.id ?? row.invoiceNo ?? ''),
      invoiceNo:    String(row.invoiceNo ?? row.invoice_number ?? '—'),
      orderId:      String(row.orderId ?? '—'),
      customer:     String(row.customerName ?? row.customer ?? row.client ?? '—'),
      customerCode: String(row.customerCode ?? '—'),
      invoiceDate:  String(row.invoiceDate ?? ''),
      due,
      netReceivable,
      totalPaid,
      outstanding,
      overdue: aging, // null | negative (future) | 0 (today) | positive (past due)
      branch,
      salesman,
      division,
      status,
    };
  });

  return { invoices, agingData, branchMap, salesmanMap };
}

export function deriveAgingData(invoices: Invoice[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: '0-30 Days',  amount: 0 },
    { range: '30-60 Days', amount: 0 },
    { range: '60+ Days',   amount: 0 },
  ];
  invoices.forEach((inv) => {
    // Only bucket records that are actually overdue (aging >= 0)
    // Skip null (no due date) and negative (future — not yet overdue)
    if (inv.overdue === null || inv.overdue < 0 || inv.outstanding <= 0) return;
    if      (inv.overdue <= 30) buckets[0].amount += inv.outstanding;
    else if (inv.overdue <= 60) buckets[1].amount += inv.outstanding;
    else                        buckets[2].amount += inv.outstanding;
  });
  return buckets;
}

export function deriveMetrics(
  invoices: Invoice[],
  branchMap: Record<string, number>
): ARMetrics {
  const totalReceivable  = invoices.reduce((sum, inv) => sum + inv.netReceivable, 0);
  const totalOutstanding = Object.values(branchMap).reduce((sum, v) => sum + v, 0);

  // Include due-today invoices (overdue === 0) in the overdue set
  const overdueInvoices = invoices.filter(
    (inv) => inv.overdue !== null && inv.overdue >= 0 && inv.outstanding > 0
  );
  const avgOverdue =
    overdueInvoices.length > 0
      ? Math.round(overdueInvoices.reduce((sum, inv) => sum + (inv.overdue ?? 0), 0) / overdueInvoices.length)
      : 0;

  return { totalReceivable, totalOutstanding, overdueInvoices, avgOverdue };
}

export function mapToSortedArray(map: Record<string, number>, limit = 8): NamedAmount[] {
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

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