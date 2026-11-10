import type { DeductionMethod, PeriodKey, TaxRegime } from "./types";

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
