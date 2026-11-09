import type { DeductionMethod, PeriodKey, TaxRegime } from "./types";

export type WithholdingIncomeType = "RENT" | "FEE" | "SERVICES" | "CONSTRUCTION" | "GOODS" | "OTHER";

export const TAX_YEARS = [2023, 2024, 2025, 2026, 2027] as const;

export const PERIOD_KEYS: PeriodKey[] = ["Q1", "Q2", "Q3", "Q4"];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
  ANNUAL: "Annual",
};

export const REGIME_LABELS: Record<TaxRegime, string> = {
  REGULAR: "Regular (25% / 20% + MCIT)",
  ENHANCED_DEDUCTIONS: "Registered · Enhanced deductions (20%)",
  SCIT: "Registered · SCIT 5% of gross income",
  INCOME_TAX_HOLIDAY: "Registered · Income tax holiday",
};

export const DEDUCTION_METHOD_LABELS: Record<DeductionMethod, string> = {
  ITEMIZED: "Itemized deductions",
  OSD: "Optional standard deduction (40%)",
};

/** Doc Table 5 — withholding rates for payments to a group company. */
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

/**
 * The only rate this module can defend: a sales-invoice line carries no income type,
 * so a service fee is assumed and nothing else is claimed.
 */
export const ASSUMED_WITHHOLDING_TYPE: WithholdingIncomeType = "SERVICES";
export const ASSUMED_WITHHOLDING_LABEL = "assumed service fee";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2025-03" → "Mar 2025"; anything unexpected falls back to the raw key. */
export function formatMonth(month: string): string {
  const label = MONTH_LABELS[Number(month.slice(5, 7)) - 1];
  return label ? `${label} ${month.slice(0, 4)}` : month;
}

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}
