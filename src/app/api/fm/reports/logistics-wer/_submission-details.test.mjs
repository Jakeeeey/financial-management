import assert from "node:assert/strict";
import test from "node:test";
import { canEditReturnedSubmission, toPayableSubmissionDetails } from "./_submission-details.ts";

test("returns editable line fields and receipt IDs without unrelated header data", () => {
  const result = toPayableSubmissionDetails({
    planId: 42,
    submission: {
      id: 35,
      status: "submitted",
      totalAmount: 1250,
      submittedBy: 8,
      decisionRemarks: "internal decision note",
      lines: [
        {
          id: 101,
          lineNo: 1,
          amount: 750,
          referenceNo: "REF-1",
          remarks: "Fuel",
          date: "2026-10-07",
          coaId: 17,
          receipts: [{ id: 501, fileId: "receipt-a" }],
        },
        {
          id: 102,
          lineNo: 2,
          amount: 500,
          referenceNo: null,
          remarks: null,
          date: null,
          coaId: 18,
          receipts: [],
        },
      ],
    },
  }, 42, 8);

  assert.deepEqual(result, {
    submissionId: 35,
    canEdit: false,
    lines: [
      {
        id: 101,
        lineNo: 1,
        amount: 750,
        referenceNo: "REF-1",
        date: "2026-10-07",
        coaId: 17,
        remarks: "Fuel",
        receipts: [{ id: 501, fileId: "receipt-a" }],
      },
      {
        id: 102,
        lineNo: 2,
        amount: 500,
        referenceNo: null,
        date: null,
        coaId: 18,
        remarks: null,
        receipts: [],
      },
    ],
  });
});

test("does not return submission details when the submission belongs to another plan", () => {
  assert.equal(toPayableSubmissionDetails({ planId: 7, submission: { id: 35, lines: [] } }, 42, 8), null);
});

test("only the original submitter can edit an unconverted returned submission", () => {
  const returned = { id: 35, status: "returned", submittedBy: 8, disbursementId: null, lines: [] };
  assert.equal(canEditReturnedSubmission(returned, 8), true);
  assert.equal(canEditReturnedSubmission(returned, 9), false);
  assert.equal(canEditReturnedSubmission({ ...returned, status: "submitted" }, 8), false);
  assert.equal(canEditReturnedSubmission({ ...returned, disbursementId: 3 }, 8), false);
});
