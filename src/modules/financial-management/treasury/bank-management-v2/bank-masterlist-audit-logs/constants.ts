/**
 * Fixed vocabularies for the Master List lane, transcribed from FSD-ERP-BNK-2026-V1.
 *
 * These are the only sources of the severity thresholds and the badge labels, so the
 * lane never hard-codes a colour or renames a status locally.
 */

export const STALE_CHECK_DAYS = 180;
export const UNCLEARED_DEPOSIT_DAYS = 3;

/** Rows per page for the masterlist and findings tables, which paginate in the browser. */
export const LIST_PAGE_SIZE = 10;

/** Sentinel a filter uses to mean "do not narrow by this field"; the API drops it too. */
export const ALL = "ALL";

/** Badge tone classes, per QA.md: outline variant plus tint. */
const TONE_CLASS: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

export type Tone = keyof typeof TONE_CLASS;

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.neutral;
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  DORMANT: "warning",
  CLOSED: "neutral",
  RECONCILED: "success",
  DRAFT: "neutral",
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status?.toUpperCase()] ?? "neutral";
}

/** `IN_CLEARING` → `In clearing`, `PARTIALLY_BOUNCED` → `Partially bounced`. */
export function statusLabel(status: string): string {
  if (!status) return "—";
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
