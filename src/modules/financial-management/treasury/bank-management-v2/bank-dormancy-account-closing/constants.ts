/**
 * Fixed vocabularies for Dormancy & Account Closing (FSD §3.5, Table 9).
 *
 * Thresholds come from the FSD; the tone helpers keep badge colours identical to the
 * other Bank Management V2 modules.
 */

/** Rows per page in the dormancy scan; the pager hides itself below two pages. */
export const PAGE_SIZE = 10;

/** FSD Table 9 — months without customer-initiated movement. */
export const INACTIVE_MONTHS = 6;
export const DORMANT_MONTHS = 12;
export const ESCHEAT_MONTHS = 120;

/** Statutory retention after closure: 10 years. */
export const RETENTION_YEARS = 10;

/** Final withholding tax on accrued interest at closure (§3.5 step 2). */
export const FINAL_WHT_RATE = 0.2;

export const REALIZE_DATE_MAX = 10;

export const DORMANCY_CLASSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DORMANT_ELIGIBLE", label: "Dormant-eligible" },
  { value: "DORMANT", label: "Dormant" },
  { value: "ESCHEAT_ELIGIBLE", label: "Escheat-eligible" },
] as const;

export const ACCOUNT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "DORMANT", label: "Dormant" },
  { value: "CLOSED", label: "Closed" },
] as const;

export const CLOSURE_REASONS = [
  "Business relationship ended",
  "Account merged into another account",
  "Dormant — escheated under Act No. 3936",
  "Bank-initiated closure",
] as const;

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

const TONE_ACCENT: Record<string, string> = {
  success: "border-l-emerald-500 from-emerald-50/70 dark:from-emerald-950/40",
  warning: "border-l-amber-500 from-amber-50/70 dark:from-amber-950/40",
  danger: "border-l-red-500 from-red-50/70 dark:from-red-950/40",
  info: "border-l-blue-500 from-blue-50/70 dark:from-blue-950/40",
  neutral: "border-l-border from-muted/40 dark:from-muted/10",
};

export function accentClass(tone: Tone): string {
  return TONE_ACCENT[tone] ?? TONE_ACCENT.neutral;
}

const CLASS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  INACTIVE: "info",
  DORMANT_ELIGIBLE: "warning",
  DORMANT: "warning",
  ESCHEAT_ELIGIBLE: "danger",
};

export function classTone(value: string): Tone {
  return CLASS_TONE[value] ?? "neutral";
}

const CLASS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DORMANT_ELIGIBLE: "Dormant-eligible",
  DORMANT: "Dormant",
  ESCHEAT_ELIGIBLE: "Escheat-eligible",
};

export function classLabel(value: string): string {
  return CLASS_LABEL[value] ?? value;
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  DORMANT: "warning",
  CLOSED: "neutral",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status?.toUpperCase()] ?? "neutral";
}

/** `DORMANT_ELIGIBLE` → `Dormant eligible`. */
export function statusLabel(status: string): string {
  if (!status) return "—";
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const EVENT_LABELS: Record<string, string> = {
  E16: "Dormancy reclassification to GL 201800",
  E17: "Escheatment to the National Treasury (Act No. 3936)",
  E18: "Account closure settlement — interest, final tax, net payout",
};

export const EMPTY_FILTERS = {
  bankName: null as string | null,
  classification: "ALL" as const,
  status: "ALL" as const,
  q: "",
};
