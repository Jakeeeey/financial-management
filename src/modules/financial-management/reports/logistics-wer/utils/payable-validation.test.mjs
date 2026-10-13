import assert from "node:assert/strict";
import test from "node:test";
import { canRunPayableAction, hasCompletePayableOrganization, isPayableFormDirty, validatePayableLines } from "./payable-validation.ts";

const baselineLine = {
  amount: "",
  referenceNo: "",
  remarks: "",
  date: "2026-10-07",
  coaId: "",
  divisionId: "",
  receipts: [],
};

test("the default date is part of the pristine baseline", () => {
  assert.equal(isPayableFormDirty([{ ...baselineLine, key: 1 }], [{ ...baselineLine, key: 9 }]), false);
});

test("adding a line, changing a field, or attaching a receipt makes the form dirty", () => {
  assert.equal(isPayableFormDirty([baselineLine, { ...baselineLine }], [baselineLine]), true);
  assert.equal(isPayableFormDirty([{ ...baselineLine, amount: "12.00" }], [baselineLine]), true);
  assert.equal(isPayableFormDirty([{ ...baselineLine, divisionId: "4" }], [baselineLine]), true);
  assert.equal(
    isPayableFormDirty([{ ...baselineLine, receipts: [{ fileId: "file-1" }] }], [baselineLine]),
    true,
  );
  const completedLine = { ...baselineLine, amount: "12.00", coaId: "4" };
  assert.equal(isPayableFormDirty([completedLine, { ...completedLine }], [completedLine]), true);
});

test("adding and removing a line back to baseline restores the pristine state", () => {
  const edited = [baselineLine, { ...baselineLine }];
  assert.equal(isPayableFormDirty(edited, [baselineLine]), true);
  assert.equal(isPayableFormDirty(edited.slice(0, 1), [baselineLine]), false);
});

test("returning fields and receipt list to their baseline makes the form pristine", () => {
  assert.equal(isPayableFormDirty([{ ...baselineLine, key: 2 }], [{ ...baselineLine, key: 1 }]), false);
});

test("payable amounts must be positive and have at most two decimal places", () => {
  for (const amount of ["", 0, -1]) {
    assert.equal(validatePayableLines([{ amount }], false).valid, false);
  }
  assert.equal(validatePayableLines([{ amount: 1.234 }], false).valid, false);
  assert.equal(validatePayableLines([{ amount: 1.23 }], false).valid, true);
});

test("drafts allow an omitted COA while submissions require one", () => {
  const lines = [{ amount: 12.5, coaId: null, divisionId: 3 }];
  const draftValidation = validatePayableLines(lines, false);
  const submitValidation = validatePayableLines(lines, true);
  assert.equal(draftValidation.valid, true);
  assert.equal(submitValidation.valid, false);
  const actionState = { dirty: true, busy: false, uploading: false, submissionBlocked: false };
  assert.equal(canRunPayableAction("save-draft", { ...actionState, valid: draftValidation.valid }), true);
  assert.equal(canRunPayableAction("submit", { ...actionState, valid: submitValidation.valid }), false);
  assert.equal(validatePayableLines([{ amount: 12.5, coaId: 4, divisionId: 3 }], true).valid, true);
});

test("drafts may omit a division while submissions require a valid division per line", () => {
  assert.equal(validatePayableLines([{ amount: 12.5 }], false).valid, true);
  assert.equal(validatePayableLines([{ amount: 12.5, divisionId: 0 }], false).valid, false);
  assert.equal(validatePayableLines([{ amount: 12.5 }], true, true).valid, false);
  assert.equal(validatePayableLines([{ amount: 12.5, coaId: 4, divisionId: 3 }], true, true).valid, true);
});

test("approval requires a department and a division on every payable line", () => {
  assert.equal(hasCompletePayableOrganization(null, [{ divisionId: 3 }]), false);
  assert.equal(hasCompletePayableOrganization(2, [{ divisionId: null }]), false);
  assert.equal(hasCompletePayableOrganization(2, [{ divisionId: 3 }, { divisionId: 0 }]), false);
  assert.equal(hasCompletePayableOrganization(2, [{ divisionId: 3 }, { divisionId: "4" }]), true);
});

test("invalid entered dates are rejected", () => {
  assert.equal(validatePayableLines([{ amount: 12, date: "2026-02-30" }], false).valid, false);
  assert.equal(validatePayableLines([{ amount: 12, date: "2026-02-28" }], false).valid, true);
});

test("valid changed lines are normalized without changing optional fields", () => {
  const result = validatePayableLines([{
    amount: "25.50",
    referenceNo: "  REF-1 ",
    remarks: "  Fuel  ",
    date: "2026-10-07",
    coaId: "4",
    divisionId: "9",
    receiptFileIds: ["file-1", "file-1", " "],
  }], true);

  assert.deepEqual(result, {
    valid: true,
    lines: [{
      amount: 25.5,
      referenceNo: "REF-1",
      remarks: "Fuel",
      date: "2026-10-07",
      coaId: 4,
      divisionId: 9,
      receiptFileIds: ["file-1"],
    }],
  });
});

test("returned line edits preserve valid existing IDs and reject invalid IDs", () => {
  const result = validatePayableLines([{ id: "41", amount: 12, coaId: 3 }], false);
  assert.deepEqual(result, {
    valid: true,
    lines: [{ id: 41, amount: 12, referenceNo: null, remarks: null, date: null, coaId: 3, divisionId: null, receiptFileIds: [] }],
  });
  assert.equal(validatePayableLines([{ id: "not-a-line", amount: 12 }], false).valid, false);
});

test("draft and submission actions require changes, valid fields, and an idle form", () => {
  const ready = { dirty: true, valid: true, busy: false, uploading: false, submissionBlocked: false };
  assert.equal(canRunPayableAction("save-draft", ready), true);
  assert.equal(canRunPayableAction("submit", ready), true);
  assert.equal(canRunPayableAction("save-draft", { ...ready, dirty: false }), false);
  assert.equal(canRunPayableAction("save-draft", { ...ready, valid: false }), false);
  assert.equal(canRunPayableAction("save-draft", { ...ready, busy: true }), false);
  assert.equal(canRunPayableAction("save-draft", { ...ready, uploading: true }), false);
});

test("budget overages block submission but still allow a valid draft", () => {
  const state = { dirty: true, valid: true, busy: false, uploading: false, submissionBlocked: true };
  assert.equal(canRunPayableAction("save-draft", state), true);
  assert.equal(canRunPayableAction("submit", state), false);
});
