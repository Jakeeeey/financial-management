import assert from "node:assert/strict";
import test from "node:test";
import { varianceCoaLabels } from "./variance-coa-labels";
import { calculateExpenseVariance } from "./budget-balances";

test("variance labels show the official code and title, not the internal account ID", () => {
  const labels = varianceCoaLabels([{ coaId: 120, coaCode: "1024", coaTitle: "Meal Allowance" }]);
  assert.equal(labels.get(120), "1024 \u00b7 Meal Allowance");
  assert.equal(labels.get(1024), undefined);
});

test("missing names and codes are explicit and delayed lookup results replace fallbacks", () => {
  assert.equal(varianceCoaLabels([]).get(120), undefined);
  assert.equal(varianceCoaLabels([{ coaId: 120 }]).get(120), "COA 120 (name unavailable)");
  assert.equal(varianceCoaLabels([{ coaId: 120, coaCode: "1024" }]).get(120), "1024 \u00b7 COA 120 (name unavailable)");
  assert.equal(varianceCoaLabels([{ coaId: 120, coaTitle: "Meal Allowance" }]).get(120), "Meal Allowance");
  assert.equal(varianceCoaLabels([{ coaId: 120, coaCode: "1024", coaTitle: "Meal Allowance" }]).get(120), "1024 \u00b7 Meal Allowance");
});

test("duplicate lines merge nonempty metadata without losing names or mutating sources", () => {
  const rows = [{ coaId: 120, coaCode: " 1024 ", coaTitle: "  " }, { coaId: 120, coaTitle: " Meal Allowance " }, { coaId: 120, coaCode: "", coaTitle: null }];
  const before = structuredClone(rows);
  const labels = varianceCoaLabels(rows);
  assert.equal(labels.size, 1);
  assert.equal(labels.get(120), "1024 \u00b7 Meal Allowance");
  assert.deepEqual(rows, before);
  assert.equal(varianceCoaLabels([{ coaId: null }, { coaId: 0 }, { coaId: -1 }, { coaId: 1.5 }]).size, 0);
});

test("account labels leave allocation, variance, unbudgeted flags and acknowledgments unchanged", () => {
  const variance = calculateExpenseVariance([{ coaId: 120, amount: 1000 }, { coaId: 161, amount: 600 }], [{ coaId: 120, allocatedAmount: 900, reservedAmount: 0, remainingAmount: 900, overBudgetAmount: 0 }], 1050, 0);
  const before = structuredClone(variance);
  const labels = varianceCoaLabels([{ coaId: 120, coaCode: "1024", coaTitle: "Meal Allowance" }, { coaId: 161, coaCode: "1031", coaTitle: "Fuel" }]);
  assert.deepEqual(variance.byCoa.map(row => labels.get(row.coaId)), ["1024 \u00b7 Meal Allowance", "1031 \u00b7 Fuel"]);
  assert.deepEqual(variance, before);
  assert.equal(variance.netVariance, 550);
  assert.equal(variance.requiresAcknowledgment, true);
  assert.equal(variance.byCoa[1].unbudgeted, true);
});
