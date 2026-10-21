import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultTrialBalanceFilters } from "./periods";
import {
  getTrialBalanceAppliedFilters, getTrialBalanceReportLabels, normalizeTrialBalanceFilters,
  parseTrialBalanceUrlState, serializeTrialBalanceFilters, trialBalanceFilterReset,
  trialBalanceRequestQuery, trialBalanceUrlQuery, validateTrialBalanceFilters,
} from "./filter-state";

const now = new Date("2026-10-21T00:00:00Z");
const defaults = createDefaultTrialBalanceFilters(now);

test("an empty URL starts with the current Manila month and All statuses", () => {
  const result = parseTrialBalanceUrlState(new URLSearchParams(), now);
  assert.deepEqual(result.filters, defaults);
  assert.equal(result.error, null);
});

test("all supported criteria round-trip without losing fixed dates or source values", () => {
  const filters = { ...defaults, startDate: "2025-01-01", endDate: "2025-12-31", periodType: "annually" as const,
    search: "Petty Cash", status: "Posted", accountCategory: "Expenses", reviewFlag: "Critical",
    divisionName: "North", departmentName: "Finance", sourceModule: ["Adjustment", "Disbursement"] };
  const result = parseTrialBalanceUrlState(new URLSearchParams(serializeTrialBalanceFilters(filters)), now);
  assert.deepEqual(result.filters, filters);
  assert.equal(result.error, null);
  assert.deepEqual(parseTrialBalanceUrlState(new URLSearchParams(serializeTrialBalanceFilters(filters)), new Date("2027-01-01")).filters, filters);
});

test("legacy Expense and postedOnly become canonical, non-conflicting query values", () => {
  const result = parseTrialBalanceUrlState(new URLSearchParams("accountCategory=Expense&postedOnly=true&status=Unposted"), now);
  assert.equal(result.error, null);
  assert.equal(result.filters.accountCategory, "Expenses");
  assert.equal(result.filters.status, "Posted");
  const query = new URLSearchParams(trialBalanceRequestQuery(result.filters));
  assert.equal(query.get("accountCategory"), "Expenses");
  assert.equal(query.get("status"), "Posted");
  assert.equal(query.has("postedOnly"), false);
  assert.equal(query.has("periodType"), false);
});

test("invalid date ranges and unsupported link choices require correction before loading", () => {
  for (const query of ["startDate=2026-02-30", "startDate=2026-11-01&endDate=2026-10-01", "reviewFlag=High", "accountCategory=Unknown", "status=Unknown"]) {
    assert.ok(parseTrialBalanceUrlState(new URLSearchParams(query), now).error, query);
  }
  assert.ok(validateTrialBalanceFilters({ ...defaults, startDate: "" }));
  assert.ok(validateTrialBalanceFilters({ ...defaults, reviewFlag: "High" }));
});

test("valid explicit ranges are restored honestly when a preset does not match", () => {
  const result = parseTrialBalanceUrlState(new URLSearchParams("startDate=2026-01-05&endDate=2026-02-20&periodType=monthly"), now);
  assert.equal(result.error, null);
  assert.equal(result.filters.periodType, "manual");
  assert.equal(result.filters.startDate, "2026-01-05");
});

test("normalization and canonical URLs omit defaults without losing unrelated parameters", () => {
  const filters = normalizeTrialBalanceFilters({ ...defaults, search: "  Cash  ", sourceModule: [" Sales ", "Sales", "Adjustment", " "] });
  assert.equal(filters.search, "Cash");
  assert.deepEqual(filters.sourceModule, ["Adjustment", "Sales"]);
  const query = new URLSearchParams(trialBalanceUrlQuery(filters, "keep=value&postedOnly=true&search=old&sourceModule=old"));
  assert.equal(query.get("keep"), "value");
  assert.equal(query.has("postedOnly"), false);
  assert.equal(query.has("status"), false);
  assert.deepEqual(query.getAll("sourceModule"), ["Adjustment", "Sales"]);
  assert.equal(query.get("search"), "Cash");
});

test("removing one restriction resets only its own fields", () => {
  const context = { ...defaults, search: "Cash", accountCategory: "Assets", startDate: "2026-09-01", endDate: "2026-09-30", sourceModule: ["Sales", "Adjustment"] };
  assert.deepEqual(trialBalanceFilterReset(context, "accountCategory", now), { accountCategory: "all" });
  assert.deepEqual(trialBalanceFilterReset(context, "period", now), { startDate: "2026-10-01", endDate: "2026-10-31", periodType: "monthly" });
  assert.deepEqual(trialBalanceFilterReset(context, "sourceModule:Sales", now), { sourceModule: ["Adjustment"] });
  assert.deepEqual(getTrialBalanceAppliedFilters(defaults, now), []);
  assert.ok(getTrialBalanceAppliedFilters(context, now).some(chip => chip.key === "period"));
});

test("report metadata includes every applied restriction and distinguishes provisional scope", () => {
  const context = { ...defaults, search: "Cash", accountCategory: "Expenses", reviewFlag: "Critical", divisionName: "North", departmentName: "Finance", sourceModule: ["Disbursement"] };
  assert.deepEqual(getTrialBalanceReportLabels(context), ["Transaction scope: All statuses (Provisional)", "Search: Cash", "Category: Expenses", "Review flag: Critical", "Division: North", "Department: Finance", "Source: Disbursement"]);
  assert.deepEqual(getTrialBalanceReportLabels({ ...defaults, status: "Posted" }), ["Transaction scope: Posted transactions"]);
});
