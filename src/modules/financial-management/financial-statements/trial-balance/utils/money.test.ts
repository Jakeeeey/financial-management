import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTrialBalanceAmount, getPeriodMovementLabel } from "./money";

test("peso amounts preserve signs and always show two decimals", () => {
  for (const [amount, expected] of [
    [4245.2, "₱4,245.20"], [-4245.2, "-₱4,245.20"],
    [0, "₱0.00"], [0.01, "₱0.01"], [-0.01, "-₱0.01"],
  ] as const) {
    assert.equal(formatTrialBalanceAmount(amount), expected);
  }
});

test("negative zero does not look like negative activity", () => {
  assert.equal(formatTrialBalanceAmount(-0), "₱0.00");
  assert.equal(formatTrialBalanceAmount(-0.1 + 0.3 - 0.2), "₱0.00");
});

test("net movement keeps the supplied debit or credit direction", () => {
  assert.equal(getPeriodMovementLabel({ netBalance: 500, balanceType: "Debit" }), "Debit movement");
  assert.equal(getPeriodMovementLabel({ netBalance: 500, balanceType: "Credit" }), "Credit movement");
  assert.equal(getPeriodMovementLabel({ netBalance: 0.01, balanceType: "Credit" }), "Credit movement");
});

test("zero net movement is neutral regardless of the backend direction", () => {
  for (const balanceType of ["Debit", "Credit"]) {
    assert.equal(getPeriodMovementLabel({ netBalance: 0, balanceType }), "No net movement");
    assert.equal(getPeriodMovementLabel({ netBalance: -0, balanceType }), "No net movement");
  }
});
