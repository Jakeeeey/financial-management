import { z } from "zod";

// ─── Zod Schema ─── matches the external API response exactly
export const TrialBalanceItemSchema = z.object({
  accountCategory: z.string(),
  glCode: z.string(),
  accountTitle: z.string(),
  accountType: z.string(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  netBalance: z.number(),
  balanceType: z.string(),
  reviewFlag: z.string(),
});

export const TrialBalanceListSchema = z.array(TrialBalanceItemSchema);

// ─── Inferred TypeScript types ───
export type TrialBalanceItem = z.infer<typeof TrialBalanceItemSchema>;

// ─── Filter state managed by the provider ───
export interface TrialBalanceFilterState {
  search: string;
  startDate: string;
  endDate: string;
  periodType: "manual" | "monthly" | "quarterly" | "annually";
  status: string;
  accountCategory: string;
  reviewFlag: string;
  sourceModule: string[];
  divisionName: string;
  departmentName: string;
  postedOnly: boolean;
}

// ─── Aggregated summary for the dashboard cards ───
export interface TrialBalanceSummaryData {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  accountCount: number;
  isBalanced: boolean;
}
