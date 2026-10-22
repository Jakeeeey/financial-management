import assert from "node:assert/strict";
import { test } from "node:test";
import type { FinancialPerformanceFilterState } from "../types";
import {
  createDefaultFinancialPerformanceFilters,
  formatFinancialPerformanceDateRange,
  getFinancialPerformanceComparisonLabel,
  getFinancialPerformancePeriodRange,
  getFinancialPerformanceToday,
  getFinancialPerformanceYears,
  updateFinancialPerformanceFilters,
  validateFinancialPerformanceDateRange,
  validateFinancialPerformancePeriods,
} from "./periods";

const now = new Date("2026-10-22T00:00:00Z");
const defaults = createDefaultFinancialPerformanceFilters(now);

function comparison(updates: Partial<FinancialPerformanceFilterState>) {
  const result = updateFinancialPerformanceFilters(defaults, updates);
  return { startDate: result.comparisonStartDate, endDate: result.comparisonEndDate };
}

test("defaults and a later reset use the current Manila month with prior-year comparison", () => {
  assert.equal(defaults.startDate, "2026-10-01");
  assert.equal(defaults.endDate, "2026-10-31");
  assert.equal(defaults.dataBasis, "monthly");
  assert.equal(defaults.includeComparison, true);
  assert.equal(defaults.comparisonMode, "samePeriodLastYear");
  assert.equal(defaults.comparisonStartDate, "2025-10-01");
  assert.equal(defaults.comparisonEndDate, "2025-10-31");
  assert.equal(defaults.status, "Posted");
  const reset = createDefaultFinancialPerformanceFilters(new Date("2026-11-02T00:00:00Z"));
  assert.equal(reset.startDate, "2026-11-01");
  assert.equal(reset.endDate, "2026-11-30");
  assert.equal(reset.comparisonStartDate, "2025-11-01");
});

test("Manila date boundaries determine the default month and year", () => {
  assert.equal(getFinancialPerformanceToday(new Date("2026-10-31T16:01:00Z")), "2026-11-01");
  const nextYear = createDefaultFinancialPerformanceFilters(new Date("2026-12-31T16:01:00Z"));
  assert.equal(nextYear.startDate, "2027-01-01");
  assert.equal(nextYear.comparisonStartDate, "2026-01-01");
});

test("quarter and YTD shortcuts use calendar boundaries and Manila today", () => {
  assert.deepEqual(getFinancialPerformancePeriodRange("quarterly", "2026-10-22", now), {
    startDate: "2026-10-01", endDate: "2026-12-31",
  });
  assert.deepEqual(getFinancialPerformancePeriodRange("yearToDate", "2020-05-01", now), {
    startDate: "2026-01-01", endDate: "2026-10-22",
  });
});

test("historical month, quarter and year selections produce complete periods", () => {
  assert.deepEqual(getFinancialPerformancePeriodRange("monthly", "2024-02-10", now), {
    startDate: "2024-02-01", endDate: "2024-02-29",
  });
  assert.deepEqual(getFinancialPerformancePeriodRange("quarterly", "2023-05-15", now), {
    startDate: "2023-04-01", endDate: "2023-06-30",
  });
  assert.deepEqual(getFinancialPerformancePeriodRange("annually", "2022-09-10", now), {
    startDate: "2022-01-01", endDate: "2022-12-31",
  });
});

test("previous calendar periods include complete months, quarters and years", () => {
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod" }), { startDate: "2026-09-01", endDate: "2026-09-30" });
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", startDate: "2026-01-01", endDate: "2026-01-31" }), {
    startDate: "2025-12-01", endDate: "2025-12-31",
  });
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", dataBasis: "quarterly", startDate: "2026-01-01", endDate: "2026-03-31" }), {
    startDate: "2025-10-01", endDate: "2025-12-31",
  });
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", dataBasis: "annually", startDate: "2026-01-01", endDate: "2026-12-31" }), {
    startDate: "2025-01-01", endDate: "2025-12-31",
  });
});

test("previous custom and YTD periods use the preceding equal inclusive day count", () => {
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", dataBasis: "manual", startDate: "2026-03-10", endDate: "2026-03-20" }), {
    startDate: "2026-02-27", endDate: "2026-03-09",
  });
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", dataBasis: "yearToDate", startDate: "2026-01-01", endDate: "2026-01-05" }), {
    startDate: "2025-12-27", endDate: "2025-12-31",
  });
  assert.deepEqual(comparison({ comparisonMode: "previousPeriod", dataBasis: "manual", startDate: "2026-03-10", endDate: "2026-03-10" }), {
    startDate: "2026-03-09", endDate: "2026-03-09",
  });
});

test("prior-year calendar months retain their own leap-year boundaries", () => {
  assert.deepEqual(comparison({ startDate: "2025-02-01", endDate: "2025-02-28" }), { startDate: "2024-02-01", endDate: "2024-02-29" });
  assert.deepEqual(comparison({ startDate: "2024-02-01", endDate: "2024-02-29" }), { startDate: "2023-02-01", endDate: "2023-02-28" });
});

test("prior-year custom and YTD endpoints clamp February 29", () => {
  assert.deepEqual(comparison({ dataBasis: "manual", startDate: "2024-02-29", endDate: "2024-03-01" }), {
    startDate: "2023-02-28", endDate: "2023-03-01",
  });
  assert.deepEqual(comparison({ dataBasis: "yearToDate", startDate: "2024-01-01", endDate: "2024-02-29" }), {
    startDate: "2023-01-01", endDate: "2023-02-28",
  });
});

test("custom comparison edits remain independent while automatic modes follow reporting dates", () => {
  const custom = updateFinancialPerformanceFilters(defaults, { comparisonMode: "custom", comparisonStartDate: "2020-06-01", comparisonEndDate: "2020-06-15" });
  const changed = updateFinancialPerformanceFilters(custom, { ...getFinancialPerformancePeriodRange("quarterly", "2026-10-22"), dataBasis: "quarterly" });
  assert.equal(changed.comparisonStartDate, "2020-06-01");
  assert.equal(changed.comparisonEndDate, "2020-06-15");
  const automatic = updateFinancialPerformanceFilters(changed, { comparisonMode: "samePeriodLastYear", includeComparison: false });
  const reenabled = updateFinancialPerformanceFilters(automatic, { includeComparison: true });
  assert.equal(reenabled.comparisonStartDate, "2025-10-01");
  assert.equal(reenabled.comparisonEndDate, "2025-12-31");
});

test("invalid or reversed ranges cannot generate, while disabled comparison dates are ignored", () => {
  assert.ok(validateFinancialPerformanceDateRange("", "2026-10-31"));
  assert.ok(validateFinancialPerformanceDateRange("2025-02-29", "2025-03-01"));
  assert.ok(validateFinancialPerformanceDateRange("2026-10-31", "2026-10-01"));
  assert.equal(validateFinancialPerformanceDateRange("2024-02-29", "2024-03-01"), null);
  assert.match(validateFinancialPerformancePeriods({ ...defaults, startDate: "" })!, /^Reporting period:/);
  const invalidComparison = { ...defaults, comparisonMode: "custom" as const, comparisonStartDate: "", comparisonEndDate: "" };
  assert.match(validateFinancialPerformancePeriods(invalidComparison)!, /^Comparison period:/);
  assert.equal(validateFinancialPerformancePeriods({ ...invalidComparison, includeComparison: false }), null);
  assert.doesNotThrow(() => updateFinancialPerformanceFilters(defaults, { startDate: "" }));
});

test("year choices move with the current year and retain historical selections", () => {
  const years = getFinancialPerformanceYears([2001, 2025, 0, Number.NaN], now);
  assert.equal(years[0], 2027);
  assert.ok(years.includes(2016));
  assert.ok(years.includes(2001));
  assert.equal(years.length, 13);
  assert.equal(years.includes(0), false);
  assert.equal(getFinancialPerformanceYears([], new Date("2027-01-01T00:00:00Z"))[0], 2028);
});

test("report and comparison labels include both exact dates without timezone shifts", () => {
  assert.equal(formatFinancialPerformanceDateRange("2026-10-01", "2026-10-31"), "Oct 1, 2026 to Oct 31, 2026");
  assert.equal(getFinancialPerformanceComparisonLabel(defaults), "Comparison (Oct 1, 2025 to Oct 31, 2025)");
  assert.equal(getFinancialPerformanceComparisonLabel({ ...defaults, includeComparison: false }), "");
  assert.equal(formatFinancialPerformanceDateRange("", ""), "Enter a valid date range");
});
