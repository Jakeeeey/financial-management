import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeFinancialPerformanceStatus,
  FINANCIAL_PERFORMANCE_SOURCE_MODULES,
} from "./report-coverage";

test("report coverage lists the source modules included by the BFF default", () => {
  assert.deepEqual(FINANCIAL_PERFORMANCE_SOURCE_MODULES, [
    "Sales",
    "Sales Invoice",
    "Disbursement",
    "Collection",
  ]);
});

test("report status context describes the backend's posted-entry rule", () => {
  assert.equal(
    describeFinancialPerformanceStatus("Posted"),
    "Posted (includes Sales Invoice entries marked Dispatched)",
  );
  assert.equal(describeFinancialPerformanceStatus("All"), "All transaction statuses");
  assert.equal(describeFinancialPerformanceStatus("Rejected"), "Rejected");
});
