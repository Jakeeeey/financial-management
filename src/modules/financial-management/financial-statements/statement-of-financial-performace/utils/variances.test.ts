import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFinancialPerformanceChange,
  formatFinancialPerformanceRatioChange,
  getFinancialPerformanceChange,
  getFinancialPerformanceRatioChange,
} from "./variances";

test("financial changes use the displayed sign convention and centavo precision", () => {
  assert.equal(getFinancialPerformanceChange(150, 100), 50);
  assert.equal(getFinancialPerformanceChange(200, 150, true), -50);
  assert.equal(getFinancialPerformanceChange(100.1, 100.09), 0.01);
});

test("financial change labels state direction without implying favorability", () => {
  const peso = (amount: number) => `₱${amount.toFixed(2)}`;

  assert.equal(formatFinancialPerformanceChange(5000, peso), "Increased by ₱5000.00");
  assert.equal(formatFinancialPerformanceChange(-5000, peso), "Decreased by ₱5000.00");
  assert.equal(formatFinancialPerformanceChange(0, peso), "No change");
});

test("ratio changes use percentage points and are unavailable when either ratio is not applicable", () => {
  const change = getFinancialPerformanceRatioChange(42.5, 40.5);

  assert.equal(change, 2);
  assert.equal(formatFinancialPerformanceRatioChange(change!), "Increased by 2.00 percentage points");
  assert.equal(getFinancialPerformanceRatioChange(null, 40.5), undefined);
  assert.equal(getFinancialPerformanceRatioChange(42.5, null), undefined);
});
