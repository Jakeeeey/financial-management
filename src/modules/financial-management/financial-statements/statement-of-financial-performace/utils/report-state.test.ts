import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDefaultFinancialPerformanceFilters,
  getFinancialPerformancePeriodRange,
  updateFinancialPerformanceFilters,
} from "./periods";
import {
  getFinancialPerformanceAppliedFilterChips,
  hasPendingFinancialPerformanceChanges,
  parseFinancialPerformanceUrl,
  removeFinancialPerformanceFilterChip,
  serializeFinancialPerformanceReportCriteria,
  toFinancialPerformanceReportCriteria,
} from "./report-state";

const now = new Date("2026-10-22T00:00:00Z");
const defaults = createDefaultFinancialPerformanceFilters(now);

test("report URL serialization restores every applied criterion but excludes local search", () => {
  const filters = updateFinancialPerformanceFilters(defaults, {
    dataBasis: "quarterly",
    ...getFinancialPerformancePeriodRange("quarterly", "2026-10-01", now),
    comparisonMode: "previousPeriod",
    taxRate: 18.5,
    divisionName: "North",
    departmentName: "Accounting",
    searchQuery: "local-only",
  });
  const criteria = toFinancialPerformanceReportCriteria(filters);
  const query = serializeFinancialPerformanceReportCriteria(criteria);
  const restored = parseFinancialPerformanceUrl(new URLSearchParams(query), now);

  assert.equal(restored.hasCriteria, true);
  assert.deepEqual(toFinancialPerformanceReportCriteria(restored.filters), criteria);
  assert.equal(query.includes("searchQuery"), false);
});

test("a URL without report criteria keeps defaults without auto-generation", () => {
  const parsed = parseFinancialPerformanceUrl(new URLSearchParams("tab=summary"), now);

  assert.equal(parsed.hasCriteria, false);
  assert.equal(parsed.filters.startDate, defaults.startDate);
  assert.equal(parsed.filters.endDate, defaults.endDate);
});

test("organizational All sentinels in a URL restore as unfiltered criteria", () => {
  const parsed = parseFinancialPerformanceUrl(
    new URLSearchParams("divisionName=All&departmentName=all"),
    now,
  );

  assert.equal(parsed.filters.divisionName, "");
  assert.equal(parsed.filters.departmentName, "");
});

test("pending comparison ignores local search but detects all generated report changes", () => {
  const applied = toFinancialPerformanceReportCriteria(defaults);
  assert.equal(hasPendingFinancialPerformanceChanges({ ...defaults, searchQuery: "sales" }, applied), false);
  assert.equal(hasPendingFinancialPerformanceChanges({ ...defaults, taxRate: 20 }, applied), true);
  assert.equal(hasPendingFinancialPerformanceChanges({ ...defaults, includeComparison: false }, applied), true);
  assert.equal(hasPendingFinancialPerformanceChanges(defaults, null), false);
});

test("removing applied filter chips stages defaults in draft state", () => {
  const selected = updateFinancialPerformanceFilters(defaults, {
    dataBasis: "manual",
    startDate: "2026-04-01",
    endDate: "2026-04-15",
    comparisonMode: "custom",
    comparisonStartDate: "2025-03-01",
    comparisonEndDate: "2025-03-15",
    includeComparison: true,
    taxRate: 18,
    divisionName: "North",
    departmentName: "Accounting",
  });

  const removed = removeFinancialPerformanceFilterChip(selected, "comparison", now);
  assert.equal(removed.includeComparison, false);
  assert.equal(selected.includeComparison, true);
  assert.equal(removeFinancialPerformanceFilterChip(selected, "taxRate", now).taxRate, 25);
  assert.equal(removeFinancialPerformanceFilterChip(selected, "divisionName", now).divisionName, "");
  assert.equal(removeFinancialPerformanceFilterChip(selected, "departmentName", now).departmentName, "");
  assert.equal(removeFinancialPerformanceFilterChip(selected, "period", now).startDate, "2026-10-01");
});

test("applied chips identify changed period and selected report filters", () => {
  const filters = updateFinancialPerformanceFilters(defaults, {
    dataBasis: "quarterly",
    ...getFinancialPerformancePeriodRange("quarterly", "2026-07-01", now),
    taxRate: 15,
    divisionName: "South",
  });
  const chips = getFinancialPerformanceAppliedFilterChips(toFinancialPerformanceReportCriteria(filters), now);

  assert.deepEqual(chips.map(chip => chip.key), ["period", "comparison", "taxRate", "divisionName"]);
  assert.match(chips[0].label, /Jul 1, 2026 to Sep 30, 2026/);
  assert.match(chips[2].label, /15%/);
});
