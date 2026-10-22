import assert from "node:assert/strict";
import test from "node:test";
import { FinancialPerformanceResponseSchema } from "./financial-performance.schema";

test("financial performance response accepts not-applicable ratios as null", () => {
  const parsed = FinancialPerformanceResponseSchema.safeParse({
    entries: [],
    totalRevenue: 0,
    totalCostOfSales: 0,
    grossProfit: 0,
    totalOperatingExpenses: 0,
    operatingIncome: 0,
    totalOtherIncome: 0,
    totalOtherExpense: 0,
    incomeBeforeTax: 0,
    incomeTaxExpense: 0,
    netIncome: 0,
    taxRateUsed: 0.25,
    grossProfitMargin: null,
    operatingExpenseRatio: null,
    netProfitMargin: null,
    effectiveTaxRate: null,
  });

  assert.equal(parsed.success, true);
});
