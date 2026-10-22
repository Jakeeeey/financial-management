import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrialBalanceItem, TrialBalanceReportContext } from "../types/trial-balance.schema";
import { createDefaultTrialBalanceFilters } from "./periods";
import { calculateTrialBalanceSummary, getTrialBalanceDifferenceMessage } from "./summary";

const context: TrialBalanceReportContext = createDefaultTrialBalanceFilters(new Date("2026-10-21T00:00:00Z"));
const account = (totalDebit: number, totalCredit: number): TrialBalanceItem => ({
  accountCategory: "Assets", glCode: "1000", accountTitle: "Cash", accountType: "Current Asset",
  totalDebit, totalCredit, netBalance: 0, balanceType: "Debit", reviewFlag: "Normal",
});

test("binary floating-point noise does not create a report difference", () => {
  const summary = calculateTrialBalanceSummary([account(0.1, 0.3), account(0.2, 0)], context);
  assert.equal(summary.totalDebit, 0.3);
  assert.equal(summary.totalCredit, 0.3);
  assert.equal(summary.difference, 0);
  assert.equal(summary.isBalanced, true);
});

test("signed differences preserve debit excess, credit excess, and a real centavo", () => {
  for (const [debit, credit, expected] of [[1000, 500, 500], [500, 1000, -500], [1.01, 1, 0.01], [1, 1.01, -0.01]]) {
    const summary = calculateTrialBalanceSummary([account(debit, credit)], context);
    assert.equal(summary.difference, expected);
    assert.equal(summary.isBalanced, false);
  }
});

test("negative amounts and many small amounts reconcile at centavo precision", () => {
  const summary = calculateTrialBalanceSummary([
    ...Array.from({ length: 1000 }, () => account(0.01, 0)),
    account(-2.34, 7.66),
  ], context);
  assert.equal(summary.totalDebit, 7.66);
  assert.equal(summary.totalCredit, 7.66);
  assert.equal(summary.isBalanced, true);
});

test("any narrowing report filter prevents a full-report reconciliation claim", () => {
  const restrictions: Partial<TrialBalanceReportContext>[] = [
    { search: "Cash" }, { accountCategory: "Assets" }, { reviewFlag: "Critical" },
    { divisionName: "Division A" }, { departmentName: "Finance" }, { sourceModule: ["Disbursement"] },
  ];
  for (const restriction of restrictions) {
    const summary = calculateTrialBalanceSummary([account(500, 0)], { ...context, ...restriction });
    assert.equal(summary.scope, "filtered", JSON.stringify(restriction));
    assert.equal(summary.difference, 500);
  }
  assert.equal(calculateTrialBalanceSummary([], null).scope, "filtered");
});

test("period and status define the base report scope", () => {
  for (const status of ["all", "Posted", "Unposted"]) {
    assert.equal(calculateTrialBalanceSummary([], { ...context, status }).scope, "report");
  }
  assert.equal(calculateTrialBalanceSummary([], { ...context, postedOnly: true }).scope, "report");
  assert.equal(calculateTrialBalanceSummary([], { ...context, search: "  " }).scope, "report");
});

test("empty results retain an account count so the UI can avoid a balance claim", () => {
  const summary = calculateTrialBalanceSummary([], context);
  assert.equal(summary.accountCount, 0);
  assert.equal(summary.totalDebit, 0);
  assert.equal(summary.totalCredit, 0);
  assert.equal(summary.difference, 0);
});

test("difference messages identify the direction and include peso precision", () => {
  assert.equal(getTrialBalanceDifferenceMessage(500), "Debits exceed credits by ₱500.00");
  assert.equal(getTrialBalanceDifferenceMessage(-500), "Credits exceed debits by ₱500.00");
  assert.equal(getTrialBalanceDifferenceMessage(0.01), "Debits exceed credits by ₱0.01");
  assert.equal(getTrialBalanceDifferenceMessage(-0.01), "Credits exceed debits by ₱0.01");
  assert.equal(getTrialBalanceDifferenceMessage(0), "Debits and credits match");
});
