/**
 * Fixed vocabularies for Bank Management V2, transcribed from FSD-ERP-BNK-2026-V1.
 *
 * These are the only sources of status labels, tone classes and picklist values so a
 * lane never hard-codes a colour or renames a status locally.
 */

/** Same vocabulary the dormancy, deposit and masterlist lanes write, so no status is lost on edit. */
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

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  DORMANT: "warning",
  INACTIVE: "danger",
  ESCHEATED: "warning",
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
  MAPPED: "success",
  NOT_MAPPED: "danger",
  NEEDS_DECISION: "warning",
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

/** Page size for the onboarding register, per QA.md pagination rules. */
export const ONBOARDING_PAGE_SIZE = 10;

/** Filter sentinel for "no filter" on the enum selects. */
export const ALL_OPTION = "ALL";

export const CURRENCY_OPTIONS = ["PHP", "USD"] as const;

export const EMPTY_FILTERS = {
  bank: ALL_OPTION,
  accountType: ALL_OPTION,
  status: ALL_OPTION,
  currency: ALL_OPTION,
  search: "",
};

export const MISSING_COLUMNS_NOTICE =
  "The new account fields are not in the database yet, so the register shows the base columns until the DDL is applied.";

/**
 * `chart_of_accounts` has no cash flag (isPayment is false on every row and there is
 * no parent/group column), so the title is the only cash signal the data carries.
 */
export const CASH_TITLE_PATTERN = /cash/i;

/**
 * A bank account's own cash is not money in transit: 4012 `Cash in Transit - Bank Clearing`
 * is where clearing keys post, so it is a transit account even though its title says cash.
 */
export const MONEY_IN_TRANSIT_TITLE_PATTERN = /in transit/i;

export function isCashAccountTitle(title: string): boolean {
  return CASH_TITLE_PATTERN.test(title) && !MONEY_IN_TRANSIT_TITLE_PATTERN.test(title);
}

export const GL_PICKER_PLACEHOLDER = "Choose a cash or cash-equivalent GL";
export const GL_PICKER_EMPTY = "No cash or cash-equivalent GL account matches that search.";
export const GL_PICKER_UNAVAILABLE =
  "No cash or cash-equivalent GL accounts were returned, so the chart of accounts could not be read.";
export const GL_PICKER_NON_CASH_WARNING =
  "This GL is not titled as cash or a cash equivalent. Accounting should confirm the mapping.";
/** P53: an existing non-cash link is a defect, not a preference, so the save is refused until it is fixed. */
export const GL_PICKER_NON_CASH_BLOCKED =
  "This account is linked to a non-cash GL. Choose a cash or cash-equivalent GL to save.";
export const GL_LINK_NOT_CASH = "Not a cash account";

/** Both keys must resolve before a parked transfer can settle, so the save flow checks them together. */
export const CLEARING_MAPPING_KEYS = ["BANK_CLEARING", "TRANSFER_IN_TRANSIT"] as const;

/** Keys with no defensible account in this chart of accounts yet, so "Not mapped" would mislead. */
export const MAPPING_KEYS_NEEDING_DECISION = new Set([
  "DEPOSIT_LIABILITY_ACTIVE",
  "DORMANT_LIABILITY",
  "ESCHEAT_PAYABLE",
  "CLOSURE_PAYOUT",
  "DEPOSIT_INTEREST_EXPENSE",
  "NTP_CONTROL",
]);

/** `bank_gl_mapping` keys in words; the raw key stays visible as a mono subtitle. */
export const MAPPING_LABELS: Record<string, string> = {
  CASH_IN_BANK: "Cash in bank",
  CASH_ON_HAND: "Cash on hand",
  BANK_CLEARING: "Bank clearing",
  TRANSFER_IN_TRANSIT: "Transfers in transit",
  OPENING_EQUITY: "Opening balance equity",
  AR_CONTROL: "Accounts receivable control",
  AP_CONTROL: "Accounts payable control",
  DEPOSIT_LIABILITY_ACTIVE: "Deposit liability (active)",
  DORMANT_LIABILITY: "Dormant deposit liability",
  ESCHEAT_PAYABLE: "Escheat payable",
  CLOSURE_PAYOUT: "Account closure payout",
  FINAL_TAX_PAYABLE: "Final tax payable",
  NTP_CONTROL: "Negotiable instrument control",
  OTHER_INCOME: "Other income",
  INTEREST_INCOME: "Interest income",
  BANK_CHARGES_EXPENSE: "Bank charges expense",
  DEPOSIT_INTEREST_EXPENSE: "Deposit interest expense",
  FINAL_TAX_EXPENSE: "Final tax expense",
};

/** Cash first (what onboarding needs), then the balance sheet, then income and expense. */
export const MAPPING_GROUPS: Array<{ heading: string; keys: string[] }> = [
  { heading: "Cash", keys: ["CASH_IN_BANK", "CASH_ON_HAND"] },
  {
    heading: "Balance sheet",
    keys: [
      "BANK_CLEARING",
      "TRANSFER_IN_TRANSIT",
      "OPENING_EQUITY",
      "AR_CONTROL",
      "AP_CONTROL",
      "DEPOSIT_LIABILITY_ACTIVE",
      "DORMANT_LIABILITY",
      "ESCHEAT_PAYABLE",
      "CLOSURE_PAYOUT",
      "FINAL_TAX_PAYABLE",
      "NTP_CONTROL",
    ],
  },
  {
    heading: "Income and expense",
    keys: ["OTHER_INCOME", "INTEREST_INCOME", "BANK_CHARGES_EXPENSE", "DEPOSIT_INTEREST_EXPENSE", "FINAL_TAX_EXPENSE"],
  },
];
