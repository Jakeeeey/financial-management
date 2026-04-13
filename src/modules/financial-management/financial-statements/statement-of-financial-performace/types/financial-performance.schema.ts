import { z } from "zod";

export const FinancialPerformanceEntrySchema = z.object({
  id: z.string(),
  type: z.string(), // Sales, Purchases / Cost of Sales, Operating Expenses, Other Income, Other Expense
  account: z.string(),
  division: z.string(),
  department: z.string(),
  amount: z.number(),
  // For hierarchical grouping in summary view (optional, can be derived, but good to have)
  parentGroupId: z.string().optional(),
});

export const FinancialPerformanceSummarySchema = z.object({
  grossSales: z.number(),
  salesReturns: z.number(),
  tradeDiscounts: z.number(),
  badOrders: z.number(),
  totalDeductions: z.number(), // derived but can be from backend
  netSales: z.number(),
  costOfGoodsSold: z.number(),
  cogsBreakdown: z.object({
    beginningInventory: z.number(),
    purchases: z.number(),
    freightIn: z.number(),
    purchaseReturns: z.number(),
    endingInventory: z.number(),
  }),
  grossProfit: z.number(),
  operatingExpenses: z.number(),
  otherExpense: z.number(),
  otherIncome: z.number(),
  netOtherIncome: z.number(),
  incomeBeforeTax: z.number(),
  taxExpense: z.number(),
  netIncome: z.number(),
});

export const KeyRatiosSchema = z.object({
  grossProfitMargin: z.number(),
  operatingExpenseRatio: z.number(),
  netProfitMargin: z.number(),
  effectiveTaxRate: z.number(),
});

export const FinancialPerformanceResponseSchema = z.object({
  entries: z.array(FinancialPerformanceEntrySchema),
  summary: FinancialPerformanceSummarySchema,
  ratios: KeyRatiosSchema,
  comparisonEntries: z.array(FinancialPerformanceEntrySchema).optional(),
  comparisonSummary: FinancialPerformanceSummarySchema.optional(),
  comparisonRatios: KeyRatiosSchema.optional(),
});

// ─── Inferred TypeScript types ───
export type FinancialPerformanceEntry = z.infer<typeof FinancialPerformanceEntrySchema>;
export type FinancialPerformanceSummary = z.infer<typeof FinancialPerformanceSummarySchema>;
export type KeyRatiosData = z.infer<typeof KeyRatiosSchema>;
export type FinancialPerformanceResponse = z.infer<typeof FinancialPerformanceResponseSchema>;

// ─── Filter state managed by the provider ───
export interface FinancialPerformanceFilterState {
  searchQuery: string;
  startDate: string;
  endDate: string;
  status: string;
  taxRate: number;
  includeComparison: boolean;
  divisionName: string;
  departmentName: string;
  comparisonStartDate: string;
  comparisonEndDate: string;
  dataBasis: "manual" | "monthly" | "quarterly" | "annually";
  comparisonBasis: "monthly" | "quarterly" | "annually";
}

export interface ValidationStatus {
  isValidated: boolean;
  isCertified: boolean;
  issues: string[];
}
