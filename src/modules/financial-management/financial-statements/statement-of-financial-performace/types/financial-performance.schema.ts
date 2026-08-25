import { z } from "zod";

export const FinancialPerformanceEntrySchema = z.object({
  glCode: z.string().nullable().optional(),
  accountTitle: z.string(),
  accountType: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  reportSection: z.string().nullable().optional(),
  amount: z.number(),
});

export const FinancialPerformanceResponseSchema = z.object({
  entries: z.array(FinancialPerformanceEntrySchema),
  totalRevenue: z.number(),
  totalCostOfSales: z.number(),
  grossProfit: z.number(),
  totalOperatingExpenses: z.number(),
  operatingIncome: z.number(),
  totalOtherIncome: z.number(),
  totalOtherExpense: z.number(),
  incomeBeforeTax: z.number(),
  incomeTaxExpense: z.number(),
  netIncome: z.number(),
  taxRateUsed: z.number(),
  grossProfitMargin: z.number(),
  operatingExpenseRatio: z.number(),
  netProfitMargin: z.number(),
  effectiveTaxRate: z.number(),
});

// ─── Inferred TypeScript types ───
export type FinancialPerformanceEntry = z.infer<typeof FinancialPerformanceEntrySchema>;
export type FinancialPerformanceResponseData = z.infer<typeof FinancialPerformanceResponseSchema>;

export interface FinancialPerformanceResponse extends FinancialPerformanceResponseData {
  comparisonData?: FinancialPerformanceResponseData;
}

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
