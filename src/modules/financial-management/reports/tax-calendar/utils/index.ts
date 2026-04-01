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
  const diff = dueDate.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
}

export function getDaysLabel(a: TaxActivity): { text: string; className: string } {
  if (a.status === 'PAID' || a.status === 'FILED') {
    return { text: '—', className: 'text-muted-foreground' };
  }
  const days = daysUntil(a.due_date);
  if (days < 0)   return { text: `${Math.abs(days)}d ago`, className: 'text-red-600 font-semibold' };
  if (days === 0) return { text: 'Today',                  className: 'text-orange-600 font-semibold' };
  if (days <= 7)  return { text: `${days}d`,               className: 'text-orange-500 font-semibold' };
  return { text: `${days}d`, className: 'text-foreground font-semibold' };
}

export function deriveMetrics(activities: TaxActivity[]) {
  return {
    pending: activities.filter((a) => a.status === 'PENDING').length,
    overdue: activities.filter((a) => a.status === 'OVERDUE').length,
    filed:   activities.filter((a) => a.status === 'FILED').length,
    paid:    activities.filter((a) => a.status === 'PAID').length,
  };
}

export function getUpcoming(activities: TaxActivity[]): TaxActivity[] {
  return activities
    .filter((a) => a.status === 'PENDING' && daysUntil(a.due_date) <= 7 && daysUntil(a.due_date) >= 0)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export function applyFilters(
  activities: TaxActivity[],
  search: string,
  statusFilter: string,
  typeFilter: string,
): TaxActivity[] {
  return activities.filter((a) => {
    if (statusFilter !== 'All' && a.status !== statusFilter) return false;
    if (typeFilter   !== 'All' && a.tax_type !== typeFilter) return false;
    const q = search.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) &&
             !a.tax_type.toLowerCase().includes(q) &&
             !(a.description ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
}

// Note: icon components must be imported at component level, not here
// So we export just the class strings for icon selection
export const STATUS_ICON_NAME: Record<TaxStatus, string> = {
  PENDING: 'Clock',
  FILED:   'FileText',
  PAID:    'CheckCircle2',
  OVERDUE: 'AlertCircle',
};