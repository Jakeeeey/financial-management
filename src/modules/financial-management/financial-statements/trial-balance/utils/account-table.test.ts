import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrialBalanceItem } from "../types/trial-balance.schema";
import {
  calculateTrialBalanceCategorySubtotal,
  groupTrialBalanceAccounts,
  sortTrialBalanceAccounts,
} from "./account-table";

function account(
  glCode: string,
  accountCategory: string,
  totalDebit: number,
  totalCredit: number,
  accountTitle = glCode,
): TrialBalanceItem {
  const net = Math.round((totalDebit - totalCredit) * 100) / 100;
  return {
    accountCategory,
    glCode,
    accountTitle,
    accountType: "Current",
    totalDebit,
    totalCredit,
    netBalance: Math.abs(net),
    balanceType: net < 0 ? "Credit" : "Debit",
    reviewFlag: "Normal",
  };
}

test("groups categories in report order and maps unknown categories to Other", () => {
  const groups = groupTrialBalanceAccounts([
    account("3", "Revenue", 0, 30),
    account("1", "Assets", 20, 0),
    account("2", "Unclassified", 5, 0),
  ]);
  assert.deepEqual(groups.map(group => group.category), ["Assets", "Revenue", "Other"]);
  assert.deepEqual(groups.map(group => group.accounts.length), [1, 1, 1]);
});

test("sorts account codes, titles, and amounts within their categories", () => {
  const items = [
    account("A-10", "Assets", 30, 0, "Cash"),
    account("A-2", "Assets", 10, 0, "Accounts Receivable"),
    account("R-1", "Revenue", 0, 40, "Sales"),
  ];
  assert.deepEqual(sortTrialBalanceAccounts(items, "glCode", "asc").map(item => item.glCode), ["A-2", "A-10", "R-1"]);
  assert.deepEqual(sortTrialBalanceAccounts(items, "accountTitle", "desc").map(item => item.accountTitle), ["Cash", "Accounts Receivable", "Sales"]);
  assert.deepEqual(sortTrialBalanceAccounts(items, "totalDebit", "desc").map(item => item.glCode), ["A-10", "A-2", "R-1"]);
});

test("sorts net movement by signed debit and credit direction within categories", () => {
  const items = [
    account("A-1", "Assets", 0, 50),
    account("A-2", "Assets", 25, 0),
    account("A-3", "Assets", 0, 10),
  ];
  assert.deepEqual(sortTrialBalanceAccounts(items, "netBalance", "asc").map(item => item.glCode), ["A-1", "A-3", "A-2"]);
  assert.deepEqual(sortTrialBalanceAccounts(items, "netBalance", "desc").map(item => item.glCode), ["A-2", "A-3", "A-1"]);
});

test("category subtotal preserves signed activity and derives the net direction at centavo precision", () => {
  assert.deepEqual(calculateTrialBalanceCategorySubtotal([
    account("1", "Assets", 100.01, 0),
    account("2", "Assets", 0, 125.02),
    account("3", "Assets", -25.01, 0),
  ]), {
    totalDebit: 75,
    totalCredit: 125.02,
    netMovement: 50.02,
    movementType: "Credit movement",
  });
  assert.equal(calculateTrialBalanceCategorySubtotal([account("1", "Equity", 0.3, 0), account("2", "Equity", 0, 0.3)]).movementType, "No net movement");
});
