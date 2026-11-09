import type { DeductionMethod, TaxRegime } from "./types";

export const TAX_YEARS = [2023, 2024, 2025, 2026, 2027] as const;

export const VAT_RATE = 0.12;
export const PERCENTAGE_TAX_RATE = 0.03;
export const OSD_RATE = 0.4;
export const MCIT_RATE = 0.02;
export const CORPORATE_RATE = 0.25;
export const SMALL_CORPORATION_RATE = 0.2;
export const SMALL_CORPORATION_NTI_CEILING = 5_000_000;
export const SMALL_CORPORATION_ASSET_CEILING = 100_000_000;
export const MCIT_START_YEAR = 4;

export const REGIME_LABELS: Record<TaxRegime, string> = {
  REGULAR: "Regular (25% / 20% + MCIT)",
  ENHANCED_DEDUCTIONS: "Registered · Enhanced deductions (20%)",
  SCIT: "Registered · SCIT 5% of gross income",
  INCOME_TAX_HOLIDAY: "Registered · Income tax holiday",
};

export const REGIME_SHORT: Record<TaxRegime, string> = {
  REGULAR: "Regular",
  ENHANCED_DEDUCTIONS: "Enhanced deductions",
  SCIT: "SCIT 5%",
  INCOME_TAX_HOLIDAY: "Holiday",
};

export const DEDUCTION_METHOD_LABELS: Record<DeductionMethod, string> = {
  ITEMIZED: "Itemized deductions",
  OSD: "Optional standard deduction (40%)",
};

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

/** Rows per page in the company table. */
export const PAGE_SIZE = 10;

/** Carryover lot kinds, in the order the schema declares them. */
export const CARRYOVER_KIND_LABELS: Record<string, string> = {
  NOLCO: "NOLCO",
  EXCESS_MCIT: "Excess MCIT",
  OVERPAYMENT: "Overpayment",
  INPUT_VAT: "Excess input VAT",
};

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

/** Card accent: coloured left rail plus a wash that fades to the card surface. */
const TONE_ACCENT: Record<Tone, string> = {
  success: "border-l-emerald-500 from-emerald-50/70 dark:from-emerald-950/40",
  warning: "border-l-amber-500 from-amber-50/70 dark:from-amber-950/40",
  danger: "border-l-red-500 from-red-50/70 dark:from-red-950/40",
  info: "border-l-blue-500 from-blue-50/70 dark:from-blue-950/40",
  neutral: "border-l-border from-muted/40 dark:from-muted/10",
};

export function accentClass(tone: Tone): string {
  return TONE_ACCENT[tone];
}

export function statusTone(status: string): Tone {
  switch (status.toUpperCase()) {
    case "LOCKED":
    case "FILED":
    case "PAID":
    case "SETTLED":
    case "MATCHED":
      return "success";
    case "DUE":
    case "SHORT":
    case "NOT_ENTERED":
      return "warning";
    case "OVERDUE":
    case "OVER":
    case "UNREADABLE":
      return "danger";
    case "OVERPAID":
    case "OPEN":
    case "UPCOMING":
      return "info";
    default:
      return "neutral";
  }
}

/** Positive position is still payable; negative is an overpayment sitting as credit. */
export function netPositionClass(value: number): string {
  if (value > 0) return "text-amber-700 dark:text-amber-400";
  if (value < 0) return "text-emerald-700 dark:text-emerald-400";
  return "text-muted-foreground";
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
