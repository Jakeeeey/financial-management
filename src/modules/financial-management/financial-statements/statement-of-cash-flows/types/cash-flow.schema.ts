import { z } from "zod";

// Schema for individual cash flow entry
export const CashFlowEntrySchema = z.object({
  cashFlowActivity: z.string().nullable().optional(),
  transactionDate: z.string().nullable().optional(), // ISO string from Instant
  transactionRef: z.string().nullable().optional(),
  netCashFlow: z.number().nullable().optional(),
  journalEntryId: z.string().nullable().optional(),
  sourceModule: z.string().nullable().optional(),
});

export const CashFlowTransactionAccountLineSchema = z.object({
  accountNumber: z.string().nullable().optional(),
  accountTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  debit: z.number(),
  credit: z.number(),
});

export const CashFlowTransactionDetailsSchema = z.object({
  journalEntryId: z.string(),
  sourceModule: z.string(),
  transactionRef: z.string().nullable().optional(),
  transactionDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  lines: z.array(CashFlowTransactionAccountLineSchema),
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
  uncategorizedCount: z.number().optional(),
  uncategorizedNetMovement: z.number().optional(),
  registerNetMovement: z.number().optional(),
  reconciliationDifference: z.number().optional(),
  beginningCash: z.number().optional(),
  endingCash: z.number().optional(),
});

// Inferred TypeScript types
export type CashFlowEntry = z.infer<typeof CashFlowEntrySchema>;
export type CashFlowResponse = z.infer<typeof CashFlowResponseSchema>;
export type CashFlowTransactionDetails = z.infer<typeof CashFlowTransactionDetailsSchema>;
export type CashFlowSummary = z.infer<typeof CashFlowSummarySchema>;

// Filter state interface
export interface CashFlowFilterState {
  startDate: string;
  endDate: string;
}

export type CashFlowActivityFilter = "all" | "operating" | "investing" | "financing" | "uncategorized";
export type CashFlowView = "statement" | "transactions";
export type CashFlowSortField = "transactionDate" | "netCashFlow" | "cashFlowActivity";
export type CashFlowSortOrder = "asc" | "desc";

export interface CashFlowUrlState extends CashFlowFilterState {
  view: CashFlowView;
  search: string;
  activity: CashFlowActivityFilter;
  sortField: CashFlowSortField;
  sortOrder: CashFlowSortOrder;
  page: number;
  pageSize: 10 | 25 | 50;
}

// Grouped entries for display
export interface GroupedCashFlowEntries {
  operating: CashFlowEntry[];
  investing: CashFlowEntry[];
  financing: CashFlowEntry[];
  other: CashFlowEntry[];
}
