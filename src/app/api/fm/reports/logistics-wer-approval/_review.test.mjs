import assert from "node:assert/strict";
import test from "node:test";
import { addCoaLabelsToLines, buildSubmissionBudgetByCoa } from "./_review.ts";

test("adds COA code and title to each payable line by account ID", () => {
  const lines = [
    { id: 1, coaId: 20 },
    { id: 2, coaId: 10 },
    { id: 3, coaId: null },
    { id: 4, coaId: 99 },
  ];
  const accounts = [
    { coa_id: 10, gl_code: "5100", account_title: "Fuel Expense" },
    { coa_id: "20", gl_code: "5200", account_title: "Travel Expense" },
  ];

  assert.deepEqual(addCoaLabelsToLines(lines, accounts), [
    { id: 1, coaId: 20, coaCode: "5200", coaTitle: "Travel Expense" },
    { id: 2, coaId: 10, coaCode: "5100", coaTitle: "Fuel Expense" },
    { id: 3, coaId: null, coaCode: null, coaTitle: null },
    { id: 4, coaId: 99, coaCode: null, coaTitle: null },
  ]);
});

test("normalizes blank account labels to null", () => {
  assert.deepEqual(
    addCoaLabelsToLines([{ coaId: 8 }], [{ coa_id: 8, gl_code: " ", account_title: "  " }]),
    [{ coaId: 8, coaCode: null, coaTitle: null }],
  );
});

test("builds one allocated budget entry per COA used by the submission", () => {
  const lines = [
    { coaId: 10, coaCode: "5100", coaTitle: "Fuel Expense" },
    { coaId: 10, coaCode: "5100", coaTitle: "Fuel Expense" },
    { coaId: 20, coaCode: "5200", coaTitle: "Travel Expense" },
    { coaId: null, coaCode: null, coaTitle: null },
    { coaId: 30, coaCode: "5300", coaTitle: "Other Expense" },
  ];
  const balances = [
    { coaId: 10, allocatedAmount: 500 },
    { coaId: 20, allocatedAmount: 250 },
  ];

  assert.deepEqual(buildSubmissionBudgetByCoa(lines, balances), [
    { coaId: 10, coaCode: "5100", coaTitle: "Fuel Expense", allocatedAmount: 500 },
    { coaId: 20, coaCode: "5200", coaTitle: "Travel Expense", allocatedAmount: 250 },
    { coaId: null, coaCode: null, coaTitle: null, allocatedAmount: null },
    { coaId: 30, coaCode: "5300", coaTitle: "Other Expense", allocatedAmount: 0 },
  ]);
});
