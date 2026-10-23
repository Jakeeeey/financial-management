import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCashFlowDate,
  getCashFlowDatePresets,
  getCashFlowDateRangeError,
} from "./reporting-dates";

test("cash flow date presets use Manila calendar dates at UTC day boundaries", () => {
  const dates = getCashFlowDatePresets(new Date("2026-09-30T16:00:00.000Z"));

  assert.deepEqual(dates, {
    today: "2026-10-01",
    monthToDateStart: "2026-10-01",
    lastMonthStart: "2026-09-01",
    lastMonthEnd: "2026-09-30",
    yearToDateStart: "2026-01-01",
  });
});

test("last month and year to date cross the new-year boundary correctly", () => {
  const dates = getCashFlowDatePresets(new Date("2025-12-31T16:00:00.000Z"));

  assert.equal(dates.today, "2026-01-01");
  assert.equal(dates.monthToDateStart, "2026-01-01");
  assert.equal(dates.lastMonthStart, "2025-12-01");
  assert.equal(dates.lastMonthEnd, "2025-12-31");
  assert.equal(dates.yearToDateStart, "2026-01-01");
});

test("date-only report labels do not shift with the runtime timezone", () => {
  assert.equal(formatCashFlowDate("2026-10-01"), "Oct 1, 2026");
});

test("date range validation rejects reversed or incomplete ranges", () => {
  assert.equal(
    getCashFlowDateRangeError("2026-10-02", "2026-10-01"),
    "Start date must be on or before end date."
  );
  assert.equal(getCashFlowDateRangeError("", "2026-10-01"), "Please select both start and end dates.");
  assert.equal(getCashFlowDateRangeError("2026-10-01", "2026-10-01"), null);
});
