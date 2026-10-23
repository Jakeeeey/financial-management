import { z } from "zod";

// ─── Zod Schemas ─── matches the external API response exactly

export const BalanceSheetEntrySchema = z.object({
  coaId: z.number().int(),
  glCode: z.string(),
  accountTitle: z.string(),
  accountType: z.string(),
  subClassification: z.string(),
  majorClassification: z.string(),
  amount: z.number(),
});

export const BalanceSheetSummarySchema = z.object({
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  totalEquity: z.number(),
  balanceVariance: z.number(),
  currentRatio: z.number(),
  quickRatio: z.number(),
  debtToEquityRatio: z.number(),
  debtRatio: z.number(),
});

export const BalanceSheetResponseSchema = z.object({
  entries: z.array(BalanceSheetEntrySchema),
  summary: BalanceSheetSummarySchema,
  comparisonEntries: z.array(BalanceSheetEntrySchema).nullable().optional(),
  comparisonSummary: BalanceSheetSummarySchema.nullable().optional(),
});

export const DrillDownEntrySchema = z.object({
  source: z.string(),
  reference: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
});

export const BalanceSheetDrillDownResponseSchema = z.object({
  openingBalance: z.number(),
  periodMovement: z.number(),
  closingBalance: z.number(),
  reconciliationDifference: z.number(),
  transactions: z.array(DrillDownEntrySchema),
});

// ─── Inferred TypeScript types ───
export type BalanceSheetEntry = z.infer<typeof BalanceSheetEntrySchema>;
export type BalanceSheetSummary = z.infer<typeof BalanceSheetSummarySchema>;
export type BalanceSheetResponse = z.infer<typeof BalanceSheetResponseSchema>;
export type DrillDownEntry = z.infer<typeof DrillDownEntrySchema>;
export type BalanceSheetDrillDownResponse = z.infer<typeof BalanceSheetDrillDownResponseSchema>;

// ─── Filter state managed by the provider ───
export interface BalanceSheetFilterState {
  startDate: string;
  endDate: string;
  status: string;
  includeComparison: boolean;
  divisionName: string;
  departmentName: string;
  comparisonStartDate: string;
  comparisonEndDate: string;
  dataBasis: "as-of" | "manual" | "monthly" | "quarterly" | "annually";
  comparisonBasis: "match" | "as-of" | "manual" | "monthly" | "quarterly" | "annually";
}
