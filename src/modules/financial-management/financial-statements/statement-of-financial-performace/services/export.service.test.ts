import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { FinancialPerformanceEntry, FinancialPerformanceResponse } from "../types";
import { matchesFinancialPerformanceEntrySearch } from "../utils/account-search";
import {
  buildFinancialPerformanceAccountBreakdownExportData,
  buildFinancialPerformanceExcelWorksheet,
  buildFinancialPerformanceExportData,
  type FinancialPerformanceExportContext,
} from "./export.service";

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

function exportContext(searchQuery = "", includeComparison = false): FinancialPerformanceExportContext {
  return {
    criteria: {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      status: "Posted",
      taxRate: 25,
      includeComparison,
      divisionName: "",
      departmentName: "",
      comparisonStartDate: "2025-01-01",
      comparisonEndDate: "2025-01-31",
      dataBasis: "monthly",
      comparisonMode: "samePeriodLastYear",
    },
    comparisonStatus: includeComparison ? "available" : "not-requested",
    searchQuery,
    generatedAt: new Date("2026-02-01T01:30:00.000Z"),
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

test("account breakdown export uses the visible search scope and excludes undisplayed sections", () => {
  const data = response([
    entry({ glCode: "6101", division: "North Division", department: "Finance" }),
    entry({ glCode: "6102", accountTitle: "Travel", department: "Operations" }),
    entry({ glCode: "4099", accountTitle: "Contra Sales", reportSection: "Contra Revenue" }),
    entry({ glCode: "4001", accountTitle: "Sales", reportSection: "Sales" }),
  ]);

  const byDivision = buildFinancialPerformanceAccountBreakdownExportData(data, "north division");
  const byDepartment = buildFinancialPerformanceAccountBreakdownExportData(data, "operations");
  const allVisible = buildFinancialPerformanceAccountBreakdownExportData(data, "");

  assert.equal(byDivision.accountCount, 1);
  assert.equal(byDivision.tableRows[0].raw[1], "6101");
  assert.equal(byDepartment.accountCount, 1);
  assert.equal(byDepartment.tableRows[0].raw[2], "Travel");
  assert.equal(allVisible.accountCount, 3);
  assert.deepEqual(allVisible.tableRows.map(row => row.raw[0]), ["Sales", "Operating Expenses", "Operating Expenses"]);
});

test("account breakdown search matches code, title, section, division, and department", () => {
  const account = entry({ glCode: "6101", division: "North Division", department: "Finance" });

  for (const query of ["6101", "utilities", "operating expenses", "north division", "finance"]) {
    assert.equal(matchesFinancialPerformanceEntrySearch(account, query), true, query);
  }
  assert.equal(matchesFinancialPerformanceEntrySearch(account, "unrelated"), false);
});

test("Excel worksheet keeps expense amounts numeric with peso formatting and applied report metadata", () => {
  const data = response([
    entry({ amount: 100 }),
    entry({ accountTitle: "Unsupported contra row", reportSection: "Contra Revenue" }),
  ]);
  const worksheet = buildFinancialPerformanceExcelWorksheet(data, "statement", exportContext("no matching account"));
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  let expenseRow = -1;
  let reportingPeriodRow = -1;
  let accountScopeRow = -1;
  let generatedAtRow = -1;
  let utilitiesRow = -1;
  const metadata = new Map<string, unknown>();

  for (let row = 0; row <= range.e.r; row += 1) {
    const firstCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v;
    if (firstCell === "Operating Expenses") expenseRow = row;
    if (firstCell === "Reporting period") reportingPeriodRow = row;
    if (firstCell === "Account detail scope") accountScopeRow = row;
    if (firstCell === "Generated at") generatedAtRow = row;
    if (String(firstCell).includes("Utilities")) utilitiesRow = row;
    if (typeof firstCell === "string") {
      metadata.set(firstCell, worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })]?.v);
    }
  }

  assert.notEqual(expenseRow, -1);
  assert.notEqual(reportingPeriodRow, -1);
  assert.notEqual(accountScopeRow, -1);
  assert.notEqual(generatedAtRow, -1);
  assert.notEqual(utilitiesRow, -1);
  const accountScopeCell = worksheet[XLSX.utils.encode_cell({ r: accountScopeRow, c: 1 })];
  assert.equal(accountScopeCell?.v, "Full applied statement layout");
  const amountCell = worksheet[XLSX.utils.encode_cell({ r: expenseRow, c: 1 })];
  assert.equal(amountCell?.t, "n");
  assert.equal(amountCell?.v, -100);
  assert.equal(amountCell?.z, "₱#,##0.00;-₱#,##0.00;₱0.00");
  assert.match(String(worksheet[XLSX.utils.encode_cell({ r: generatedAtRow, c: 1 })]?.v), /PHT/);
  assert.match(String(worksheet[XLSX.utils.encode_cell({ r: reportingPeriodRow, c: 1 })]?.v), /Jan/);
  assert.equal(metadata.get("Transaction status"), "Posted (includes Sales Invoice entries marked Dispatched)");
  assert.equal(metadata.get("Division"), "All divisions");
  assert.equal(metadata.get("Department"), "All departments");
  assert.equal(metadata.get("Currency"), "PHP — Philippine peso");
  assert.match(String(metadata.get("Income-tax assumption")), /25\.00%/);
  assert.match(String(metadata.get("Source coverage")), /Disbursement, Collection/);
});

test("Excel comparison amounts stay numeric and zero activity is recorded separately", () => {
  const current = response([entry({ amount: 100 })]);
  const comparison = response([
    entry({ amount: 50 }),
    entry({ coaId: 13, glCode: "6108", accountTitle: "Prior-only expense", amount: 75 }),
  ]);
  const data: FinancialPerformanceResponse = { ...current, comparisonData: comparison };
  const worksheet = buildFinancialPerformanceExcelWorksheet(data, "statement", exportContext("", true));
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  let priorOnlyRow = -1;

  for (let row = 0; row <= range.e.r; row += 1) {
    const firstCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v;
    if (String(firstCell).includes("Prior-only expense")) priorOnlyRow = row;
  }

  assert.notEqual(priorOnlyRow, -1);
  const comparisonPeriodRow = Array.from({ length: range.e.r + 1 }, (_, row) => row)
    .find(row => worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v === "Comparison period");
  assert.notEqual(comparisonPeriodRow, undefined);
  assert.match(String(worksheet[XLSX.utils.encode_cell({ r: comparisonPeriodRow!, c: 1 })]?.v), /Jan/);
  for (const column of [1, 2, 3]) {
    const amountCell = worksheet[XLSX.utils.encode_cell({ r: priorOnlyRow, c: column })];
    assert.equal(amountCell?.t, "n");
    assert.equal(amountCell?.z, "₱#,##0.00;-₱#,##0.00;₱0.00");
  }
  assert.equal(worksheet[XLSX.utils.encode_cell({ r: priorOnlyRow, c: 1 })]?.v, 0);
  assert.equal(worksheet[XLSX.utils.encode_cell({ r: priorOnlyRow, c: 2 })]?.v, 75);
  assert.equal(worksheet[XLSX.utils.encode_cell({ r: priorOnlyRow, c: 4 })]?.v, "Zero activity in current period");
});

test("account breakdown Excel amount remains numeric with peso formatting", () => {
  const data = response([entry({ amount: -1250.5 })]);
  const worksheet = buildFinancialPerformanceExcelWorksheet(data, "account-breakdown", exportContext("utilities"));
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  let accountRow = -1;

  for (let row = 0; row <= range.e.r; row += 1) {
    if (worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })]?.v === "6101") accountRow = row;
  }

  assert.notEqual(accountRow, -1);
  const amountCell = worksheet[XLSX.utils.encode_cell({ r: accountRow, c: 5 })];
  assert.equal(amountCell?.t, "n");
  assert.equal(amountCell?.v, -1250.5);
  assert.equal(amountCell?.z, "₱#,##0.00;-₱#,##0.00;₱0.00");
});
