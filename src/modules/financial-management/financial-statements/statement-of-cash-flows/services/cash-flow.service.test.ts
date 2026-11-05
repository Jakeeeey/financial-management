import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CashFlowResponseSchema,
  CashFlowTransactionDetailsSchema,
  type CashFlowEntry,
} from "../types/cash-flow.schema";
import { calculateCashFlowSummary, groupCashFlowEntries } from "./cash-flow.service";

const entries: CashFlowEntry[] = [
  { cashFlowActivity: "Operating", netCashFlow: 100 },
  { cashFlowActivity: "Investing", netCashFlow: -40 },
  { cashFlowActivity: "Financing", netCashFlow: 15 },
  { cashFlowActivity: null, netCashFlow: -12 },
  { cashFlowActivity: "Other", netCashFlow: 7 },
  { cashFlowActivity: "", netCashFlow: 0 },
];

test("missing and unrecognized activities are grouped as uncategorized", () => {
  const grouped = groupCashFlowEntries(entries);
  assert.equal(grouped.operating.length, 1);
  assert.equal(grouped.investing.length, 1);
  assert.equal(grouped.financing.length, 1);
  assert.deepEqual(grouped.other.map(entry => entry.cashFlowActivity), [null, "Other", ""]);
});

test("summary exposes uncategorized movement without changing reported net change", () => {
  const summary = calculateCashFlowSummary(entries);
  assert.equal(summary.uncategorizedCount, 3);
  assert.equal(summary.uncategorizedNetMovement, -5);
  assert.equal(summary.netIncreaseInCash, 75);
  assert.equal(summary.registerNetMovement, 70);
  assert.equal(summary.reconciliationDifference, -5);
});

test("fully classified entries have no register-to-report difference", () => {
  const summary = calculateCashFlowSummary(entries.slice(0, 3));
  assert.equal(summary.uncategorizedCount, 0);
  assert.equal(summary.uncategorizedNetMovement, 0);
  assert.equal(summary.registerNetMovement, summary.netIncreaseInCash);
  assert.equal(summary.reconciliationDifference, 0);
});

test("cash-flow report rows retain the journal number and source module identity", () => {
  const response = CashFlowResponseSchema.parse({
    success: true,
    data: [{
      cashFlowActivity: "Operating: Cash Paid",
      transactionDate: "2026-10-20T00:00:00Z",
      transactionRef: "DISB-100",
      netCashFlow: -250,
      journalEntryId: "JE-100",
      sourceModule: "Disbursement",
    }],
  });

  assert.equal(response.data[0].journalEntryId, "JE-100");
  assert.equal(response.data[0].sourceModule, "Disbursement");
});

test("cash-flow transaction detail contract includes account lines and balanced totals", () => {
  const details = CashFlowTransactionDetailsSchema.parse({
    journalEntryId: "JE-100",
    sourceModule: "Disbursement",
    transactionRef: "DISB-100",
    transactionDate: "2026-10-20T00:00:00Z",
    description: "Office supplies",
    status: "Posted",
    totalDebit: 250,
    totalCredit: 250,
    lines: [{
      accountNumber: "1000",
      accountTitle: "Cash on Hand",
      description: "Payment",
      debit: 0,
      credit: 250,
    }],
  });

  assert.equal(details.lines[0].accountTitle, "Cash on Hand");
  assert.equal(details.totalDebit, details.totalCredit);
});
