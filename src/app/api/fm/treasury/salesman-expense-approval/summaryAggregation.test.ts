/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves the local .ts module through CommonJS. */
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const test: typeof import("node:test") = require("node:test");
const { aggregateExpensesByEmployee } = require("./summaryAggregation.ts") as typeof import("./summaryAggregation");

test("combines one employee's expenses across multiple divisions", () => {
  const result = aggregateExpensesByEmployee([
    {
      encoded_by: 12,
      division_id: 3,
      header_id: 9001,
      status: "Drafts",
      amount: 1250,
    },
    {
      encoded_by: 12,
      division_id: 7,
      header_id: 9002,
      status: "Rejected",
      amount: 750,
    },
    {
      encoded_by: 12,
      division_id: 3,
      header_id: 9001,
      status: "With Concern",
      amount: 250,
    },
  ]);

  assert.deepEqual(Object.keys(result), ["12"]);
  assert.equal(result["12"].draft, 1);
  assert.equal(result["12"].rejected, 1);
  assert.equal(result["12"].concern, 1);
  assert.equal(result["12"].amount, 2250);
  assert.deepEqual([...result["12"].headers], [9001, 9002]);
  assert.deepEqual([...result["12"].divisions], [3, 7]);
});
