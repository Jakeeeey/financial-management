import { z } from "zod";

// Schema for individual cash flow entry
export const CashFlowEntrySchema = z.object({
  cashFlowActivity: z.string().nullable().optional(),
  transactionDate: z.string().nullable().optional(), // ISO string from Instant
  transactionRef: z.string().nullable().optional(),
  netCashFlow: z.number().nullable().optional(),
});

// Schema for the API response
export const CashFlowResponseSchema = z.object({
  data: z.array(CashFlowEntrySchema),
  success: z.boolean(),
});

// Schema for aggregated summary
export const CashFlowSummarySchema = z.object({
  operatingActivities: z.number(),
  investingActivities: z.number(),
  financingActivities: z.number(),
  netIncreaseInCash: z.number(),
  beginningCash: z.number().optional(),
  endingCash: z.number().optional(),
});

// Inferred TypeScript types
export type CashFlowEntry = z.infer<typeof CashFlowEntrySchema>;
export type CashFlowResponse = z.infer<typeof CashFlowResponseSchema>;
export type CashFlowSummary = z.infer<typeof CashFlowSummarySchema>;

// Filter state interface
export interface CashFlowFilterState {
  startDate: string;
  endDate: string;
  cashFlowActivity: string; // "Operating" | "Investing" | "Financing" | "All"
}

// Grouped entries for display
export interface GroupedCashFlowEntries {
  operating: CashFlowEntry[];
  investing: CashFlowEntry[];
  financing: CashFlowEntry[];
  other: CashFlowEntry[];
}
