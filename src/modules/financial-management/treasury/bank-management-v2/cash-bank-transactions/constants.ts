/**
 * Fixed vocabularies for the Cash & Bank Transactions lane, from FSD-ERP-BNK-2026-V1.
 *
 * Status labels, tones and picklist values live here and nowhere else, so a component never
 * hard-codes a colour or renames a stored value.
 */

import type { TransactionKind } from "./types";

export const PAGE_SIZE = 10;

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  CREDIT: "Bank credit memo",
  DEBIT: "Bank debit memo",
  INTEREST: "Interest earned",
  TRANSFER: "Fund transfer",
};

export const TRANSACTION_KIND_OPTIONS = [
  { value: "CREDIT", label: TRANSACTION_KIND_LABELS.CREDIT },
  { value: "DEBIT", label: TRANSACTION_KIND_LABELS.DEBIT },
  { value: "INTEREST", label: TRANSACTION_KIND_LABELS.INTEREST },
  { value: "TRANSFER", label: TRANSACTION_KIND_LABELS.TRANSFER },
] as const;

/** Every status the combined list can show. */
export const TRANSACTION_STATUS_OPTIONS = [
  { value: "POSTED", label: "Posted" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REVERSED", label: "Reversed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const EMPTY_FILTERS = {
  kind: "ALL" as const,
  bankName: null,
  bankAccountId: null,
  status: "",
  from: "",
  to: "",
  q: "",
  page: 1,
};

/** FSD 1.2 — every memo type and the posting event it raises. */
export const MEMO_TYPES = [
  { value: "CREDIT", label: "Bank credit memo", event: "E02" },
  { value: "DEBIT", label: "Bank debit memo", event: "E03" },
  { value: "INTEREST", label: "Interest earned", event: "E04" },
] as const;

/** FSD 1.2 — credit memo nature, resolved to a GL mapping key at posting time. */
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

/** Plain-word names for the GL keys a posting can be blocked on. */
export const MAPPING_KEY_LABELS: Record<string, string> = {
  CASH_IN_BANK: "the bank cash account",
  CASH_ON_HAND: "the cash on hand account",
  BANK_CLEARING: "the bank clearing account",
  TRANSFER_IN_TRANSIT: "the transfer-in-transit clearing account",
  INTEREST_INCOME: "the interest income account",
  OTHER_INCOME: "the other income account",
  FINAL_TAX_EXPENSE: "the final tax withheld expense account",
  BANK_CHARGES_EXPENSE: "the bank charges expense account",
  AR_CONTROL: "the accounts receivable control account",
  AP_CONTROL: "the accounts payable control account",
  NTP_CONTROL: "the net-of-tax payable control account",
  OPENING_EQUITY: "the opening balance equity account",
};

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
  PREPARED: "info",
  PENDING: "warning",
  CANCELLED: "neutral",
  CLEARED: "success",
  COMPLETED: "success",
  POSTED: "success",
  REVERSED: "neutral",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status?.toUpperCase()] ?? "neutral";
}

/** `IN_CLEARING` → `In clearing`. */
export function statusLabel(status: string): string {
  if (!status) return "—";
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** FSD Table 14 — the event codes this lane posts. */
export const EVENT_LABELS: Record<string, string> = {
  E02: "Bank credit memo",
  E03: "Bank debit memo",
  E04: "Interest earned",
  E05: "Fund transfer — same day",
  E06: "Fund transfer — later value date",
};
