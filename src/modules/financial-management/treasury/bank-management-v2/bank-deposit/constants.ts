/**
 * Fixed vocabularies for Bank Management V2, transcribed from FSD-ERP-BNK-2026-V1.
 *
 * These are the only sources of status labels, tone classes and picklist values so a
 * lane never hard-codes a colour or renames a status locally.
 */

import type { SlipFilters, UndepositedFilters } from "./types";

/** Rows per page in the module's list tables; the pager hides itself below two pages. */
export const PAGE_SIZE = 10;

/**
 * The queue defaults to posted, dated collections: an unposted or undated row cannot be
 * proved to belong on a slip. The withheld count and the scope picker keep them reachable.
 */
export const EMPTY_UNDEPOSITED_FILTERS: UndepositedFilters = {
  scope: "POSTED",
  type: "ALL",
  canDeposit: "ALL",
  from: "",
  to: "",
  q: "",
};

export const EMPTY_SLIP_FILTERS: SlipFilters = {
  bank: "",
  status: "ALL",
  from: "",
  to: "",
  q: "",
};

/** Canonical account status vocabulary for the whole bank-management family. */
export const BANK_STATUSES = ["ACTIVE", "DORMANT", "INACTIVE", "ESCHEATED", "CLOSED"] as const;

export const ACCOUNT_TYPE_OPTIONS = [
  "Savings",
  "Checking",
  "Current",
  "Time Deposit",
  "FCA",
] as const;

/** FSD 1.2 — every memo type and the posting event it raises. */
export const MEMO_TYPES = [
  { value: "CREDIT", label: "Bank credit memo", event: "E02" },
  { value: "DEBIT", label: "Bank debit memo", event: "E03" },
  { value: "INTEREST", label: "Interest earned", event: "E04" },
] as const;

/** FSD 1.2 — credit memo nature, resolved to a GL mapping key. */
export const CREDIT_NATURE_OPTIONS = [
  { value: "AR_SETTLEMENT", label: "Customer settlement (reduces AR)", mappingKey: "AR_CONTROL" },
  { value: "OTHER_INCOME", label: "Other income", mappingKey: "OTHER_INCOME" },
  { value: "INTEREST_INCOME", label: "Interest income", mappingKey: "INTEREST_INCOME" },
] as const;

export const INTEREST_TAX_RATES = [
  { value: 0.2, label: "20% — peso deposit" },
  { value: 0.15, label: "15% — FCDU deposit" },
  { value: 0, label: "0% — exempt" },
] as const;

/** FSD 1.4 — the fixed return-reason picklist. */
export const CHECK_RETURN_REASONS = [
  "Insufficient funds (NSF)",
  "Account closed",
  "Signature irregular",
  "Stale-dated",
  "Stop payment",
  "Returned by payee",
  "Wrong amount or payee",
  "Lost or damaged",
  "Spoiled",
] as const;

export const CHECK_ACTIONS = [
  { value: "RELEASE", label: "Release", issuedOnly: true },
  { value: "DEPOSIT", label: "Deposit", issuedOnly: false },
  { value: "CLEAR", label: "Mark cleared", issuedOnly: false },
  { value: "RETURN", label: "Record return", issuedOnly: false },
  { value: "CANCEL", label: "Cancel", issuedOnly: false },
  { value: "REPLACE", label: "Replace", issuedOnly: false },
] as const;

export const STALE_CHECK_DAYS = 180;
export const UNCLEARED_DEPOSIT_DAYS = 3;

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

/** Card accent: coloured left rail plus a wash that fades to the card surface. */
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

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  DORMANT: "warning",
  INACTIVE: "danger",
  ESCHEATED: "neutral",
  CLOSED: "neutral",
  PREPARED: "info",
  PENDING: "warning",
  PARTIALLY_BOUNCED: "warning",
  BOUNCED: "danger",
  RETURNED: "danger",
  CANCELLED: "neutral",
  CLEARED: "success",
  COMPLETED: "success",
  RECONCILED: "success",
  DRAFT: "neutral",
  RECEIVED: "info",
  IN_CLEARING: "info",
  POSTED: "success",
  REVERSED: "neutral",
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
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

/** Check status labels differ from their stored value. */
export const CHECK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  RECEIVED: "Received",
  IN_CLEARING: "In clearing",
  CLEARED: "Cleared",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

/** FSD Table 14 — event codes with the description used in the posting trail. */
export const EVENT_LABELS: Record<string, string> = {
  E01: "Account onboarding — opening balance",
  E02: "Bank credit memo",
  E03: "Bank debit memo",
  E04: "Interest earned",
  E05: "Fund transfer — same day",
  E06: "Fund transfer — later value date",
  E07: "Bank deposit — cash",
  E08: "Deposit slip cancelled",
  E09: "Check issued",
  E10: "Issued check cleared",
  E11: "Issued check returned or cancelled",
  E12: "Check received",
  E13: "Received check cleared",
  E14: "Received check returned or cancelled",
  E15: "Received check dishonoured after deposit",
};
