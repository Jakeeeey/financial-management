import type { CertificateDirection, PeriodKey, WithholdingIncomeType } from "./types";

export const TAX_YEARS = [2023, 2024, 2025, 2026, 2027] as const;

export const QUARTER_KEYS: PeriodKey[] = ["Q1", "Q2", "Q3", "Q4"];

/** Every `period_key` the DDL allows, in filing order. */
export const PERIOD_KEYS: PeriodKey[] = ["Q1", "Q2", "Q3", "Q4", "ANNUAL"];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
  ANNUAL: "Annual",
};

/** A certificate matches when it lands within this many pesos of the ledger figure. */
export const MATCH_TOLERANCE = 1;

export const DIRECTIONS: CertificateDirection[] = ["RECEIVED", "ISSUED"];

export const DIRECTION_LABELS: Record<CertificateDirection, string> = {
  RECEIVED: "Received (from payee)",
  ISSUED: "Issued (to supplier)",
};

/** Doc Table 5 — withholding rates as fractions of the income amount. */
export const WITHHOLDING_RATES: Record<WithholdingIncomeType, number> = {
  RENT: 0.05,
  FEE: 0.15,
  SERVICES: 0.02,
  CONSTRUCTION: 0.02,
  GOODS: 0.01,
  OTHER: 0,
};

export const WITHHOLDING_LABELS: Record<WithholdingIncomeType, string> = {
  RENT: "Rent",
  FEE: "Management / professional fee",
  SERVICES: "Services",
  CONSTRUCTION: "Construction contract",
  GOODS: "Goods",
  OTHER: "Other",
};

export const INCOME_TYPE_OPTIONS = (Object.keys(WITHHOLDING_LABELS) as WithholdingIncomeType[]).map((value) => ({
  value,
  label: WITHHOLDING_LABELS[value],
}));

/**
 * What a company can owe and remit. A 2307 is a certificate, not a payment, so it is
 * deliberately absent even though the entity-worksheet list carries it.
 */
export const BIR_FORMS = [
  "1702Q",
  "1702",
  "2550Q",
  "2551Q",
  "0619-E",
  "1601-EQ",
  "1601-C",
  "1604-C",
  "1604-E",
] as const;

/** First and last day of a quarter, as `YYYY-MM-DD`. */
export function quarterRange(year: number, index: number): { from: string; to: string } {
  const startMonth = index * 3;
  const from = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, startMonth + 3, 0)).getUTCDate();
  const to = `${year}-${String(startMonth + 3).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { from, to };
}

/** Quarter index (0..3) of a `YYYY-MM-DD` day, or null when the date is unusable. */
export function quarterOf(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(value ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return Math.min(3, Math.floor((month - 1) / 3));
}

/** True when every day of the quarter is already behind the PHT calendar day. */
export function isQuarterPast(year: number, index: number, today: string): boolean {
  const { to } = quarterRange(year, index);
  return to < today;
}

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

export function statusTone(status: string): Tone {
  switch (status.toUpperCase()) {
    case "LOCKED":
    case "FILED":
    case "PAID":
    case "MATCHED":
      return "success";
    case "DUE":
    case "SHORT":
    case "NOT_ENTERED":
      return "warning";
    case "OVERDUE":
    case "OVER":
      return "danger";
    case "OPEN":
    case "UPCOMING":
      return "info";
    default:
      return "neutral";
  }
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/** Compact labels for the certificate status chip. */
export function certificateStatusLabel(status: string): string {
  return status === "UNKNOWN" ? "Not compared" : statusLabel(status);
}

/** Page size for the client-side tables, matching the treasury module. */
export const PAGE_SIZE = 10;
