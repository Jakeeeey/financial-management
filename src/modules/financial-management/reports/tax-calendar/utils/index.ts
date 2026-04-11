// tax-calendar/utils/index.ts
import type { TaxActivity, TaxStatus } from '../types';

export function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function daysUntil(due: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
}

// ── Derived status logic ──────────────────────────────────────────────────────
// Priority order: Paid > Filed > Overdue > Upcoming > Pending
const UPCOMING_THRESHOLD = 5; // days

export function deriveStatus(a: TaxActivity): TaxStatus {
  // Paid: amount_paid exists and is non-zero
  if (a.amount_paid && Number(a.amount_paid) !== 0) return 'PAID';
  // Filed: filing date exists
  if (a.actual_filing_date) return 'FILED';
  // Overdue: past due date and not filed
  const days = daysUntil(a.due_date);
  if (days < 0) return 'OVERDUE';
  // Upcoming: within 5-day threshold
  if (days <= UPCOMING_THRESHOLD) return 'UPCOMING';
  // Pending: 6+ days before due date (default)
  return 'PENDING';
}
// ─────────────────────────────────────────────────────────────────────────────

export function getDaysLabel(a: TaxActivity): { text: string; className: string } {
  const status = deriveStatus(a);
  if (status === 'PAID' || status === 'FILED') {
    return { text: '—', className: 'text-muted-foreground' };
  }
  const days = daysUntil(a.due_date);
  if (days < 0)   return { text: `${Math.abs(days)}d ago`, className: 'text-red-600 font-semibold' };
  if (days === 0) return { text: 'Today',                  className: 'text-orange-600 font-semibold' };
  if (days <= 5)  return { text: `${days}d`,               className: 'text-orange-500 font-semibold' };
  return { text: `${days}d`, className: 'text-foreground font-semibold' };
}

export function deriveMetrics(activities: TaxActivity[]) {
  const upcomingDeadlines = activities.filter(
    (a) => deriveStatus(a) === 'UPCOMING'
  ).length;

  const overdueFilings  = activities.filter((a) => deriveStatus(a) === 'OVERDUE').length;
  const filedThisPeriod = activities.filter(
    (a) => { const s = deriveStatus(a); return s === 'FILED' || s === 'PAID'; }
  ).length;

  const total = activities.length;
  const complianceRate = total > 0 ? Math.round((filedThisPeriod / total) * 100) : 0;

  return { upcomingDeadlines, overdueFilings, filedThisPeriod, complianceRate };
}

export function getUpcoming(activities: TaxActivity[]): TaxActivity[] {
  return activities
    .filter((a) => deriveStatus(a) === 'UPCOMING')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export function applyFilters(
  activities: TaxActivity[],
  search: string,
  statusFilter: string,
  typeFilter: string,
): TaxActivity[] {
  return activities.filter((a) => {
    // Use derived status for filtering, not the stored a.status
    if (statusFilter !== 'All' && deriveStatus(a) !== statusFilter) return false;
    if (typeFilter   !== 'All' && a.tax_type !== typeFilter)        return false;
    const q = search.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) &&
             !a.tax_type.toLowerCase().includes(q) &&
             !(a.description ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
}

export const STATUS_ICON_NAME: Record<TaxStatus, string> = {
  PENDING:  'Clock',
  UPCOMING: 'AlertCircle',
  FILED:    'FileText',
  PAID:     'CheckCircle2',
  OVERDUE:  'AlertCircle',
};