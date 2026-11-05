import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultCashFlowUrlState, parseCashFlowUrlState, serializeCashFlowUrlState } from "./report-state";

const now = new Date("2026-10-21T12:00:00Z");

test("an empty URL defaults to the current Manila month and statement view", () => {
  const state = parseCashFlowUrlState(new URLSearchParams(), now);
  assert.deepEqual(state, createDefaultCashFlowUrlState(now));
  assert.equal(state.startDate, "2026-10-01");
  assert.equal(state.endDate, "2026-10-21");
  assert.equal(state.view, "statement");
});

test("applied dates and transaction view state round-trip through the URL", () => {
  const state = {
    ...createDefaultCashFlowUrlState(now),
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    view: "transactions" as const,
    search: "  TR-42  ",
    activity: "investing" as const,
    sortField: "netCashFlow" as const,
    sortOrder: "asc" as const,
    page: 2,
    pageSize: 25 as const,
  };
  const serialized = serializeCashFlowUrlState(state, "keep=value");
  const restored = parseCashFlowUrlState(new URLSearchParams(serialized), now);
  assert.equal(restored.startDate, state.startDate);
  assert.equal(restored.endDate, state.endDate);
  assert.equal(restored.view, state.view);
  assert.equal(restored.search, state.search);
  assert.equal(restored.activity, state.activity);
  assert.equal(restored.sortField, state.sortField);
  assert.equal(restored.sortOrder, state.sortOrder);
  assert.equal(restored.page, state.page);
  assert.equal(restored.pageSize, state.pageSize);
  assert.equal(new URLSearchParams(serialized).get("keep"), "value");
});

test("uncategorized activity filter round-trips through the URL", () => {
  const state = {
    ...createDefaultCashFlowUrlState(now),
    activity: "uncategorized" as const,
  };
  const serialized = serializeCashFlowUrlState(state);
  const restored = parseCashFlowUrlState(new URLSearchParams(serialized), now);
  assert.equal(restored.activity, "uncategorized");
});

test("invalid dates, activity, sorting, page, and page size fall back to safe defaults", () => {
  const state = parseCashFlowUrlState(new URLSearchParams(
    "startDate=2026-02-30&endDate=2026-02-01&activity=other&sortField=unknown&sortOrder=up&page=-2&pageSize=15",
  ), now);
  assert.deepEqual(state, createDefaultCashFlowUrlState(now));
});

test("default transaction controls are omitted while dates remain in the URL", () => {
  const state = createDefaultCashFlowUrlState(now);
  const params = new URLSearchParams(serializeCashFlowUrlState(state));
  assert.equal(params.get("startDate"), "2026-10-01");
  assert.equal(params.get("endDate"), "2026-10-21");
  assert.equal(params.has("view"), false);
  assert.equal(params.has("activity"), false);
  assert.equal(params.has("sortField"), false);
  assert.equal(params.has("page"), false);
  assert.equal(params.has("pageSize"), false);
});

test("invalid view values fall back to the statement view", () => {
  const state = parseCashFlowUrlState(new URLSearchParams("view=unknown"), now);
  assert.equal(state.view, "statement");
});
