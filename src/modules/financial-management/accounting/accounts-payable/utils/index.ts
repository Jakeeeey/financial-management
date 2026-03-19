// utils/index.ts — Pure utility functions for Accounts Payable module.

import type {
  RawAPRow, APRecord, APStatus, AgingBucket,
  SupplierEntry, StatusEntry, APMetrics,
} from '../types';

export const COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
];

export const STATUS_COLORS: Record<APStatus, string> = {
  'Paid':                    '#10b981',
  'Unpaid':                  '#94a3b8',
  'Partially Paid':          '#f59e0b',
  'Overdue':                 '#dc2626',
  'Unpaid | Overdue':        '#ef4444',
  'Partially Paid | Overdue':'#f97316',
};

export const formatPeso = (v: number): string =>
  `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (d?: string): string => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};


export function transformAPRows(raw: RawAPRow[]): APRecord[] {
  return raw.map((row, i) => {
    const amountPayable      = Number(row.totalPayable      ?? 0);
    const amountPaid         = Number(row.totalPaid         ?? 0);
    const outstandingBalance = Number(row.outstandingBalance ?? (amountPayable - amountPaid));
    const daysOverdue        = Number(row.daysOverdue       ?? 0);
    const invoiceDate        = String(row.transactionDate   ?? '');
    const dueDate            = String(row.dueDate           ?? '');

    // Status logic — Paid is single value; Unpaid/Partially Paid can append | Overdue
    let status: APStatus;
    if (amountPaid >= amountPayable && amountPayable > 0) {
      status = 'Paid';
    } else if (amountPaid === 0) {
      status = daysOverdue > 0 ? 'Unpaid | Overdue' : 'Unpaid';
    } else {
      status = daysOverdue > 0 ? 'Partially Paid | Overdue' : 'Partially Paid';
    }

    return {
      id:                 String(row.disbursementId ?? `AP-${i + 1}`),
      refNo:              String(row.docNo          ?? `AP-${i + 1}`),
      supplier:           String(row.supplierName   ?? '—'),
      // invoiceNo: API has no separate invoice number — use docNo per document spec
      invoiceNo:          String(row.docNo          ?? '—'),
      invoiceDate,
      dueDate,
      amountPayable,
      amountPaid,
      outstandingBalance,
      aging:              daysOverdue,
      status,
    };
  });
}

export function buildAgingBuckets(records: APRecord[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: '0–30 Days',  amount: 0 },
    { range: '31–60 Days', amount: 0 },
    { range: '61–90 Days', amount: 0 },
    { range: '91+ Days',   amount: 0 },
  ];
  records.forEach((r) => {
    if (r.outstandingBalance <= 0) return;
    if      (r.aging <= 30)  buckets[0].amount += r.outstandingBalance;
    else if (r.aging <= 60)  buckets[1].amount += r.outstandingBalance;
    else if (r.aging <= 90)  buckets[2].amount += r.outstandingBalance;
    else                     buckets[3].amount += r.outstandingBalance;
  });
  return buckets;
}

export function buildSupplierData(records: APRecord[]): SupplierEntry[] {
  const map: Record<string, number> = {};
  records.forEach((r) => {
    map[r.supplier] = (map[r.supplier] ?? 0) + r.outstandingBalance;
  });
  return Object.entries(map)
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function buildStatusData(records: APRecord[]): StatusEntry[] {
  const map: Record<string, number> = {};
  records.forEach((r) => { map[r.status] = (map[r.status] ?? 0) + 1; });
  return (Object.entries(map) as [APStatus, number][])
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? '#94a3b8' }));
}

export function deriveMetrics(records: APRecord[]): APMetrics {
  return {
    totalPayable:     records.reduce((s, r) => s + r.amountPayable,      0),
    totalPaid:        records.reduce((s, r) => s + r.amountPaid,         0),
    totalOutstanding: records.reduce((s, r) => s + r.outstandingBalance, 0),
    overdueCount:     records.filter((r) => r.status === 'Overdue').length,
    totalRecords:     records.length,
  };
}

export function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}