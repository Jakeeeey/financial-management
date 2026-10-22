import { z } from "zod";

export const FinancialPerformanceEntrySchema = z.object({
  coaId: z.number().nullable().optional(),
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
  grossProfitMargin: z.number().nullable(),
  operatingExpenseRatio: z.number().nullable(),
  netProfitMargin: z.number().nullable(),
  effectiveTaxRate: z.number().nullable(),
});

export const FinancialPerformanceTransactionSchema = z.object({
  journalEntryId: z.string().nullable(),
  transactionRef: z.string().nullable(),
  transactionDate: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  sourceModule: z.string().nullable(),
  division: z.string().nullable(),
  department: z.string().nullable(),
  creator: z.string().nullable(),
  debit: z.number(),
  credit: z.number(),
});

export const FinancialPerformanceTransactionsResponseSchema = z.object({
  items: z.array(FinancialPerformanceTransactionSchema),
  page: z.number(),
  pageSize: z.number(),
  totalRows: z.number(),
  totalPages: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  netActivity: z.number(),
});

// ─── Inferred TypeScript types ───
export type FinancialPerformanceEntry = z.infer<typeof FinancialPerformanceEntrySchema>;
export type FinancialPerformanceResponseData = z.infer<typeof FinancialPerformanceResponseSchema>;
export type FinancialPerformanceTransaction = z.infer<typeof FinancialPerformanceTransactionSchema>;
export type FinancialPerformanceTransactionsResponse = z.infer<typeof FinancialPerformanceTransactionsResponseSchema>;

export interface FinancialPerformanceResponse extends FinancialPerformanceResponseData {
  comparisonData?: FinancialPerformanceResponseData;
}

export type FinancialPerformanceComparisonStatus = "not-requested" | "loading" | "available" | "unavailable";

// ─── Filter state managed by the provider ───
export type FinancialPerformancePeriodBasis = "manual" | "monthly" | "quarterly" | "annually" | "yearToDate";
export type FinancialPerformanceComparisonMode = "previousPeriod" | "samePeriodLastYear" | "custom";

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
  dataBasis: FinancialPerformancePeriodBasis;
  comparisonMode: FinancialPerformanceComparisonMode;
}

export type FinancialPerformanceReportCriteria = Omit<FinancialPerformanceFilterState, "searchQuery">;

export interface ValidationStatus {
  isValidated: boolean;
  isCertified: boolean;
  issues: string[];
}
