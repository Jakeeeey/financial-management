import { z } from "zod";

// ─── Zod Schema ─── matches the external API response exactly
export const TrialBalanceItemSchema = z.object({
  accountCategory: z.string(),
  glCode: z.string(),
  accountTitle: z.string(),
  accountType: z.string(),
  totalDebit: z.number(), // Signed debit activity within the applied report period and filters.
  totalCredit: z.number(), // Signed credit activity within the applied report period and filters.
  netBalance: z.number(), // Absolute net period movement; not an opening or closing balance.
  balanceType: z.string(), // Debit/Credit direction of net period movement; neutral when netBalance is zero.
  reviewFlag: z.string(),
  reviewReason: z.string().nullable().optional(),
});

export const TrialBalanceListSchema = z.array(TrialBalanceItemSchema);

// ─── Inferred TypeScript types ───
export type TrialBalanceItem = z.infer<typeof TrialBalanceItemSchema>;

// ─── Filter state managed by the provider ───
export type TrialBalancePeriodType = "manual" | "monthly" | "quarterly" | "annually" | "yearToDate";

export interface TrialBalanceFilterState {
  search: string;
  startDate: string;
  endDate: string;
  periodType: TrialBalancePeriodType;
  status: string;
  accountCategory: string;
  reviewFlag: string;
  sourceModule: string[];
  divisionName: string;
  departmentName: string;
  postedOnly: boolean;
}

export type TrialBalanceReportContext = TrialBalanceFilterState;

// ─── Aggregated summary for the dashboard cards ───
export interface TrialBalanceSummaryData {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  accountCount: number;
  isBalanced: boolean;
  scope: "report" | "filtered";
}

// ─── Drill-down item from the trial-balance/drill-down endpoint ───
export interface TrialBalanceDrillDownItem {
  journalEntryId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  source: string;
  postedBy: string | null;
}
