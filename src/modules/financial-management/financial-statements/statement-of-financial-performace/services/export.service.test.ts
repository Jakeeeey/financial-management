import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialPerformanceEntry, FinancialPerformanceResponse } from "../types";
import { buildFinancialPerformanceExportData } from "./export.service";

function entry(overrides: Partial<FinancialPerformanceEntry> = {}): FinancialPerformanceEntry {
  return {
    coaId: 12,
    glCode: "6101",
    accountTitle: "Utilities",
    accountType: "GENERAL AND ADMINISTRATIVE EXPENSES",
    division: "1",
    department: "2",
    reportSection: "Operating Expenses",
    amount: 100,
    ...overrides,
  };
}

function response(entries: FinancialPerformanceEntry[]): FinancialPerformanceResponse {
  return {
    entries,
    totalRevenue: entries.reduce((total, item) => total + (item.reportSection === "Sales" ? item.amount : 0), 0),
    totalCostOfSales: 0,
    grossProfit: 0,
    totalOperatingExpenses: entries.reduce((total, item) => total + (item.reportSection === "Operating Expenses" ? item.amount : 0), 0),
    operatingIncome: 0,
    totalOtherIncome: 0,
    totalOtherExpense: 0,
    incomeBeforeTax: 0,
    incomeTaxExpense: 0,
    netIncome: 0,
    taxRateUsed: 0.25,
    grossProfitMargin: 0,
    operatingExpenseRatio: 0,
    netProfitMargin: 0,
    effectiveTaxRate: 0,
  };
}

test("unavailable comparison exports an explicit marker and no variance value", () => {
  const data = response([entry()]);
  const { tableRows } = buildFinancialPerformanceExportData(data, true, "unavailable", "Prior period");
  const accountRow = tableRows.find(row => String(row.raw[0]).trim() === "Utilities");

  assert.ok(accountRow);
  assert.equal(accountRow.raw[2], "Comparison unavailable");
  assert.equal(accountRow.raw[3], "");
});

test("successful comparison retains prior-only accounts with zero current activity", () => {
  const current = response([entry()]);
  const comparison = response([entry({ coaId: 18, glCode: "6108", accountTitle: "Prior-only expense", amount: 75 })]);
  const data: FinancialPerformanceResponse = { ...current, comparisonData: comparison };
  const { tableRows } = buildFinancialPerformanceExportData(data, true, "available", "Prior period");
  const priorOnlyRow = tableRows.find(row => String(row.raw[0]).trim() === "Prior-only expense");

  assert.ok(priorOnlyRow);
  assert.equal(priorOnlyRow.raw[1], 0);
  assert.equal(priorOnlyRow.raw[2], 75);
  assert.equal(priorOnlyRow.meta.currentZeroActivity, true);
});

test("expense changes follow the displayed negative sign convention", () => {
  const current = response([entry({ amount: 200 })]);
  const comparison = response([entry({ amount: 150 })]);
  const data: FinancialPerformanceResponse = { ...current, comparisonData: comparison };
  const { tableRows } = buildFinancialPerformanceExportData(data, true, "available", "Prior period");
  const expenseRow = tableRows.find(row => String(row.raw[0]).trim() === "Operating Expenses");

  assert.ok(expenseRow);
  assert.equal(expenseRow.raw[3], -50);
  assert.equal(expenseRow.meta.isNegativeFormat, true);
});

test("sales export uses signed sales activity and omits unsupported deduction subtotals", () => {
  const data = response([
    entry({ glCode: "4001", accountTitle: "Sales", reportSection: "Sales", amount: -250 }),
    entry({ glCode: "4099", accountTitle: "Unmapped contra account", reportSection: "Contra Revenue", amount: 40 }),
  ]);
  const { tableRows } = buildFinancialPerformanceExportData(data, false, "not-requested", "Prior period");
  const salesRow = tableRows.find(row => String(row.raw[0]).trim() === "Sales activity (credit less debit)");
  const labels = tableRows.map(row => String(row.raw[0]).trim());

  assert.ok(salesRow);
  assert.equal(salesRow.raw[1], -250);
  assert.equal(labels.some(label => /gross sales|total deductions|net sales|unmapped contra account/i.test(label)), false);
});

test("tax export label uses the rate returned by the report", () => {
  const data = { ...response([]), taxRateUsed: 0.125 };
  const { tableRows } = buildFinancialPerformanceExportData(data, false, "not-requested", "Prior period");
  const taxRow = tableRows.find(row => String(row.raw[0]).trim().startsWith("Estimated income tax"));

  assert.ok(taxRow);
  assert.equal(taxRow.raw[0], "    Estimated income tax (12.50% of positive pre-tax income)");
});
