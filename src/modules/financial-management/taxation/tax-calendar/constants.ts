import type { DeductionMethod, PeriodKey, TaxRegime, WithholdingIncomeType } from "./types";

export const TAX_YEARS = [2023, 2024, 2025, 2026, 2027] as const;

export const PERIOD_KEYS: PeriodKey[] = ["Q1", "Q2", "Q3", "Q4"];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
  ANNUAL: "Annual",
};

export const VAT_RATE = 0.12;
export const PERCENTAGE_TAX_RATE = 0.03;
export const OSD_RATE = 0.4;
export const MCIT_RATE = 0.02;
export const CORPORATE_RATE = 0.25;
export const SMALL_CORPORATION_RATE = 0.2;
export const SMALL_CORPORATION_NTI_CEILING = 5_000_000;
export const SMALL_CORPORATION_ASSET_CEILING = 100_000_000;
export const MCIT_START_YEAR = 4;
export const NOLCO_LIFE_YEARS = 3;
export const MCIT_CREDIT_YEARS = 3;
export const FINAL_TAX_RATE = 0.2;

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
  "2307",
] as const;

export const EFPS_GROUPS = [
  { value: "NONE", label: "Not an eFPS filer" },
  { value: "A", label: "eFPS group A · 15th" },
  { value: "B", label: "eFPS group B · 14th" },
  { value: "C", label: "eFPS group C · 13th" },
  { value: "D", label: "eFPS group D · 12th" },
  { value: "E", label: "eFPS group E · 11th" },
] as const;

export const REGIME_OPTIONS = (Object.keys(REGIME_LABELS) as TaxRegime[]).map((value) => ({
  value,
  label: REGIME_LABELS[value],
}));

export const DEDUCTION_METHOD_OPTIONS = (Object.keys(DEDUCTION_METHOD_LABELS) as DeductionMethod[]).map(
  (value) => ({ value, label: DEDUCTION_METHOD_LABELS[value] }),
);

export const DEFAULT_PROFILE = {
  assetsExcludingLand: 0,
  taxableYearOfOperations: 1,
  regime: "REGULAR" as TaxRegime,
  registeredShare: 100,
  deductionMethod: "ITEMIZED" as DeductionMethod,
  withholdingAgent: true,
  hasTopWithholdingStatus: false,
  vatRegistered: true,
  efpsGroup: "NONE" as const,
  ownsRealProperty: false,
  taxAgentFeeRate: 15,
  priorYearExcessCredit: 0,
  notes: null,
} as const;

export function quarterRange(year: number, index: number): { from: string; to: string } {
  const startMonth = index * 3;
  const from = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, startMonth + 3, 0)).getUTCDate();
  const to = `${year}-${String(startMonth + 3).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { from, to };
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

export const TAX_TONES: Record<string, Tone> = {
  REGULAR: "info",
  ENHANCED_DEDUCTIONS: "success",
  SCIT: "warning",
  INCOME_TAX_HOLIDAY: "neutral",
};

export const CALENDAR_CATEGORIES = [
  { value: "ALL", label: "All categories" },
  { value: "INCOME", label: "Income tax" },
  { value: "VAT", label: "VAT / percentage tax" },
  { value: "WITHHOLDING", label: "Withholding" },
  { value: "OTHER", label: "Other filings" },
] as const;

export const CALENDAR_STATUSES = [
  { value: "ALL", label: "Any status" },
  { value: "DUE", label: "Due" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Recorded as paid" },
] as const;
