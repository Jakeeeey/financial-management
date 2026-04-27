// ewt/utils/index.ts
// Data transform and chart-build helpers for the EWT module.
import {
  RawEWTRow,
  EWTRecord,
  PieEntry,
  TrendEntry,
  BarEntry
} from '../types';

// ── Transform ────────────────────────────────────────────────────────────────

export function transformEWTRows(raw: RawEWTRow[]): EWTRecord[] {
  return raw.map((item, i) => {
    const dateRaw = item.transactionDate ?? '';
    const dateObj = dateRaw ? new Date(dateRaw) : new Date(0);
    return {
      id:            item.docNo ?? `EWT-${i + 1}`,
      invoiceNo:     item.docNo ?? `EWT-${i + 1}`,
      customerName:  item.supplier    ?? '-',
      invoiceDate:   dateRaw,
      grossAmount:   Number(item.grossAmount   ?? 0),
      taxableAmount: Number(item.taxableAmount ?? 0),
      displayAmount: Number(item.cwt           ?? 0),
      dateObj,
    };
  });
}

// ── Chart builders ───────────────────────────────────────────────────────────

export function buildPieData(records: EWTRecord[]): PieEntry[] {
  const map: Record<string, number> = {};
  records.forEach((r) => { map[r.customerName] = (map[r.customerName] ?? 0) + r.displayAmount; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top    = sorted.slice(0, 6);
  const rest   = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  const entries: PieEntry[] = top.map(([name, value]) => ({ name, value }));
  if (rest > 0) entries.push({ name: 'Others', value: rest });
  return entries;
}

export function buildTrendData(records: EWTRecord[]): TrendEntry[] {
  const map: Record<string, number> = {};
  records.forEach((r) => {
    if (!r.dateObj || isNaN(r.dateObj.getTime())) return;
    const key = r.dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });
    map[key] = (map[key] ?? 0) + r.displayAmount;
  });
  return Object.entries(map).map(([month, amount]) => ({ month, amount }));
}

export function buildBarData(records: EWTRecord[]): BarEntry[] {
  const map: Record<string, { amount: number; count: number }> = {};
  records.forEach((r) => {
    if (!map[r.customerName]) map[r.customerName] = { amount: 0, count: 0 };
    map[r.customerName].amount += r.displayAmount;
    map[r.customerName].count  += 1;
  });
  return Object.entries(map)
    .map(([name, { amount, count }]) => ({ name, amount, count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatPeso(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(raw: string | undefined): string {
  if (!raw) return '-';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-PH');
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