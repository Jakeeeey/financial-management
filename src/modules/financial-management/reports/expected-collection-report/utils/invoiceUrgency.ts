import type { ExpectedCollectionRecord } from "../types";
import { parseDateOnly } from "./date";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type InvoiceRowStatus = "settled" | "overdue" | "critical" | "elevated" | "mellow";
export type InvoiceUrgencyBadgeVariant = "secondary" | "destructive" | "outline";

export const invoiceRowStatusClasses: Record<InvoiceRowStatus, string> = {
  settled: "bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50",
  overdue: "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50",
  critical: "bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/25 dark:hover:bg-orange-950/40",
  elevated: "bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/25 dark:hover:bg-amber-950/40",
  mellow: "bg-yellow-50/50 hover:bg-yellow-100/70 dark:bg-yellow-950/15 dark:hover:bg-yellow-950/25",
};

export const invoiceDetailsStatusClasses: Record<InvoiceRowStatus, string> = {
  settled: "bg-emerald-50/80 dark:bg-emerald-950/30",
  overdue: "bg-red-50/80 dark:bg-red-950/30",
  critical: "bg-orange-50/70 dark:bg-orange-950/25",
  elevated: "bg-amber-50/70 dark:bg-amber-950/25",
  mellow: "bg-yellow-50/50 dark:bg-yellow-950/15",
};

export const invoiceRowStatusAccentClasses: Record<InvoiceRowStatus, string> = {
  settled: "border-l-4 border-l-emerald-500",
  overdue: "border-l-4 border-l-red-500",
  critical: "border-l-4 border-l-orange-500",
  elevated: "border-l-4 border-l-amber-500",
  mellow: "border-l-4 border-l-yellow-500",
};

export interface InvoiceUrgency {
  status: InvoiceRowStatus;
  label: string;
  rank: number;
  daysUntilDue: number | null;
  badgeVariant: InvoiceUrgencyBadgeVariant;
}

function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function getInvoiceUrgency(record: ExpectedCollectionRecord, today: string): InvoiceUrgency {
  if (record.outstandingBalance === 0) {
    return {
      status: "settled",
      label: "Settled",
      rank: 0,
      daysUntilDue: null,
      badgeVariant: "secondary",
    };
  }

  const dueDate = parseDateOnly(record.dueDate);
  const currentDate = parseDateOnly(today);
  if (!dueDate || !currentDate) {
    return {
      status: "mellow",
      label: "Due date unavailable",
      rank: 1,
      daysUntilDue: null,
      badgeVariant: "outline",
    };
  }

  const daysUntilDue = Math.round((dueDate.getTime() - currentDate.getTime()) / MILLISECONDS_PER_DAY);
  if (daysUntilDue < 0) {
    const days = Math.abs(daysUntilDue);
    return {
      status: "overdue",
      label: `${days} day${days === 1 ? "" : "s"} overdue`,
      rank: 5,
      daysUntilDue,
      badgeVariant: "destructive",
    };
  }
  if (daysUntilDue === 0) {
    return {
      status: "critical",
      label: "Due today",
      rank: 4,
      daysUntilDue,
      badgeVariant: "outline",
    };
  }
  if (daysUntilDue <= 3) {
    return {
      status: "critical",
      label: `Due in ${formatDayCount(daysUntilDue)}`,
      rank: 4,
      daysUntilDue,
      badgeVariant: "outline",
    };
  }
  if (daysUntilDue <= 7) {
    return {
      status: "elevated",
      label: `Due in ${formatDayCount(daysUntilDue)}`,
      rank: 3,
      daysUntilDue,
      badgeVariant: "outline",
    };
  }
  return {
    status: "mellow",
    label: `Due in ${formatDayCount(daysUntilDue)}`,
    rank: 2,
    daysUntilDue,
    badgeVariant: "outline",
  };
}
