import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialPerformanceEntry } from "../types/financial-performance.schema";
import { alignFinancialPerformanceEntries } from "./comparison-entries";

function entry(overrides: Partial<FinancialPerformanceEntry> = {}): FinancialPerformanceEntry {
  return {
    coaId: 12,
    glCode: "4001",
    accountTitle: "Sales",
    accountType: "SALES",
    division: "1",
    department: "2",
    reportSection: "Sales",
    amount: 100,
    ...overrides,
  };
}

test("aligns the same account and dimensions using its stable COA id", () => {
  const current = entry({ amount: 125 });
  const comparison = entry({ amount: 90, accountTitle: "Renamed Sales" });

  const aligned = alignFinancialPerformanceEntries([current], [comparison]);

  assert.equal(aligned.length, 1);
  assert.equal(aligned[0].current?.amount, 125);
  assert.equal(aligned[0].comparison?.amount, 90);
});

test("keeps accounts with the same title separate when account or dimensions differ", () => {
  const current = entry();
  const comparisonEntries = [
    entry({ coaId: 13 }),
    entry({ division: "3" }),
    entry({ department: "4" }),
  ];

  const aligned = alignFinancialPerformanceEntries([current], comparisonEntries);

  assert.equal(aligned.length, 4);
  assert.equal(aligned.filter(row => row.current === null).length, 3);
  assert.equal(aligned[0].comparison, null);
});

test("retains comparison-only accounts so callers can display zero current-period activity", () => {
  const priorOnly = entry({ amount: 80, coaId: 21, accountTitle: "Prior-only account" });

  const aligned = alignFinancialPerformanceEntries([], [priorOnly]);

  assert.equal(aligned.length, 1);
  assert.equal(aligned[0].current, null);
  assert.equal(aligned[0].comparison?.amount, 80);
});

test("uses GL code and title as a compatibility key when a response lacks COA id", () => {
  const current = entry({ coaId: undefined, amount: 12 });
  const comparison = entry({ coaId: undefined, amount: 10 });

  const aligned = alignFinancialPerformanceEntries([current], [comparison]);

  assert.equal(aligned.length, 1);
  assert.equal(aligned[0].comparison?.amount, 10);
});
