import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBudgetBalances,
  findBudgetAllocationOverages,
  findBudgetRequestOverages,
  splitReservationSources,
} from "./budget-balances";

test("available expense budget comes from classified COA allocations", () => {
  const balances = calculateBudgetBalances(
    [
      { coaId: 10, amount: 250 },
      { coaId: 20, amount: 150 },
      { coaId: null, amount: 80 },
    ],
    [],
  );

  assert.equal(balances.allocatedBudget, 480);
  assert.equal(balances.remainingAmount, 400);
  assert.equal(balances.unclassifiedBudgetAmount, 80);
});

test("reservations reduce only their own COA balance", () => {
  const balances = calculateBudgetBalances(
    [{ coaId: 10, amount: 250 }, { coaId: 20, amount: 150 }],
    [{ coaId: 10, amount: 230 }, { coaId: 20, amount: 150 }],
  );

  assert.equal(balances.remainingAmount, 20);
  assert.deepEqual(balances.byCoa.map(({ coaId, remainingAmount }) => ({ coaId, remainingAmount })), [
    { coaId: 10, remainingAmount: 20 },
    { coaId: 20, remainingAmount: 0 },
  ]);
});

test("a category overage is rejected even if another category has room", () => {
  const balances = calculateBudgetBalances(
    [{ coaId: 10, amount: 100 }, { coaId: 20, amount: 300 }],
    [],
  );
  const overages = findBudgetRequestOverages(
    [{ coaId: 10, amount: 120 }, { coaId: 20, amount: 50 }],
    balances.byCoa,
  );

  assert.deepEqual(overages, [{ coaId: 10, requestedAmount: 120, remainingAmount: 100, overAmount: 20 }]);
});

test("historical overages block further spend in that category", () => {
  const balances = calculateBudgetBalances(
    [{ coaId: 10, amount: 100 }],
    [{ coaId: 10, amount: 120 }],
  );

  assert.equal(balances.remainingAmount, 0);
  assert.equal(balances.overBudgetAmount, 20);
  assert.deepEqual(findBudgetRequestOverages([{ coaId: 10, amount: 0.01 }], balances.byCoa), [
    { coaId: 10, requestedAmount: 0.01, remainingAmount: 0, overAmount: 0.01 },
  ]);
});

test("a reservation in an unbudgeted COA is visible as an overage", () => {
  const balances = calculateBudgetBalances(
    [{ coaId: 10, amount: 100 }],
    [{ coaId: 99, amount: 25 }],
  );

  assert.equal(balances.overBudgetAmount, 25);
  assert.deepEqual(balances.byCoa.find((balance) => balance.coaId === 99), {
    coaId: 99,
    allocatedAmount: 0,
    reservedAmount: 25,
    remainingAmount: 0,
    overBudgetAmount: 25,
  });
});

test("a budget line with a COA but no classification remarks is unavailable", () => {
  const balances = calculateBudgetBalances(
    [{ coaId: 10, amount: 100, classified: false }],
    [],
  );

  assert.equal(balances.remainingAmount, 0);
  assert.equal(balances.unclassifiedBudgetAmount, 100);
});

test("only submitted and approved payables reserve budget, approved records use actual disbursements", () => {
  const sources = splitReservationSources([
    { id: 1, status: "draft", disbursementId: null },
    { id: 2, status: "submitted", disbursementId: null },
    { id: 3, status: "approved", disbursementId: null },
    { id: 4, status: "approved", disbursementId: 91 },
    { id: 5, status: "returned", disbursementId: null },
    { id: 6, status: "rejected", disbursementId: null },
    { id: 7, status: "withdrawn", disbursementId: null },
  ]);

  assert.deepEqual(sources.draftReservations.map(({ id }) => id), [2, 3]);
  assert.deepEqual(sources.approvedDisbursementIds, [91]);
});

test("budget allocations cannot be reduced below reserved amounts for their COA", () => {
  const current = calculateBudgetBalances(
    [{ coaId: 10, amount: 500 }],
    [{ coaId: 10, amount: 380 }],
  );

  assert.deepEqual(
    findBudgetAllocationOverages([{ coaId: 10, amount: 379.99 }], current.byCoa),
    [{ coaId: 10, allocatedAmount: 379.99, reservedAmount: 380, shortfall: 0.01 }],
  );
  assert.deepEqual(findBudgetAllocationOverages([{ coaId: 10, amount: 380 }], current.byCoa), []);
});
