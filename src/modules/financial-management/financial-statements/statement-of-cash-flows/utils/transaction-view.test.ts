import assert from "node:assert/strict";
import { test } from "node:test";
import type { CashFlowEntry } from "../types/cash-flow.schema";
import { filterCashFlowEntries, paginateCashFlowEntries, sortCashFlowEntries, sumCashFlowEntries } from "./transaction-view";

const entries: CashFlowEntry[] = [
  { transactionRef: "OP-001", transactionDate: "2026-10-03", cashFlowActivity: "Operating", netCashFlow: 100 },
  { transactionRef: "INV-001", transactionDate: "2026-10-01", cashFlowActivity: "Investing", netCashFlow: -40 },
  { transactionRef: "OP-002", transactionDate: "2026-10-02", cashFlowActivity: "Operating", netCashFlow: 25 },
  { transactionRef: "FIN-001", transactionDate: "2026-10-04", cashFlowActivity: "Financing", netCashFlow: 15 },
];

const uncategorizedEntries: CashFlowEntry[] = [
  ...entries,
  { transactionRef: "UNK-001", transactionDate: "2026-10-05", cashFlowActivity: null, netCashFlow: -12 },
  { transactionRef: "UNK-002", transactionDate: "2026-10-06", cashFlowActivity: "Other", netCashFlow: 7 },
  { transactionRef: "UNK-003", transactionDate: "2026-10-07", cashFlowActivity: "", netCashFlow: 0 },
];

test("activity and search filters narrow the transaction register", () => {
  const filtered = filterCashFlowEntries(entries, "op-", "operating");
  assert.deepEqual(filtered.map(entry => entry.transactionRef), ["OP-001", "OP-002"]);
});

test("uncategorized filter returns missing and unrecognized activity rows only", () => {
  const filtered = filterCashFlowEntries(uncategorizedEntries, "", "uncategorized");
  assert.deepEqual(filtered.map(entry => entry.transactionRef), ["UNK-001", "UNK-002", "UNK-003"]);
});

test("filtered subtotal covers all matching rows before pagination", () => {
  const filtered = filterCashFlowEntries(entries, "", "operating");
  const page = paginateCashFlowEntries(filtered, 0, 1);
  assert.equal(page.items.length, 1);
  assert.equal(sumCashFlowEntries(filtered), 125);
});

test("pagination clamps an out-of-range page and returns accurate range bounds", () => {
  const result = paginateCashFlowEntries(entries, 8, 2);
  assert.equal(result.page, 1);
  assert.equal(result.startIndex, 2);
  assert.equal(result.endIndex, 4);
  assert.equal(result.items.length, 2);
});

test("sort order changes the visible sequence without mutating the input", () => {
  const ascending = sortCashFlowEntries(entries, "netCashFlow", "asc");
  assert.deepEqual(ascending.map(entry => entry.netCashFlow), [-40, 15, 25, 100]);
  assert.deepEqual(entries.map(entry => entry.netCashFlow), [100, -40, 25, 15]);
});
