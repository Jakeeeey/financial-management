import assert from "node:assert/strict";
import test from "node:test";
import { fetchLogisticsWerDetails, fetchPayableSubmissionDetails, savePayableDraft } from "./logisticsWerApi.ts";

test("maps official disbursement document numbers into WER submission summaries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 42,
    docNo: "DP-42",
    werPayables: {
      submissions: [
        {
          id: 35,
          status: "approved",
          totalAmount: 400,
          disbursementId: 2382,
          disbursementDocNo: "NT-1787233119332",
          treasuryStatus: "Draft",
          lineCount: 3,
          receiptCount: 1,
        },
        {
          id: 34,
          status: "approved",
          totalAmount: 250,
          disbursementId: 2381,
          disbursementDocNo: null,
          treasuryStatus: "Draft",
          lineCount: 1,
          receiptCount: 0,
        },
      ],
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const details = await fetchLogisticsWerDetails(42);
    assert.equal(details.submissions?.[0].disbursementDocNo, "NT-1787233119332");
    assert.equal(details.submissions?.[0].disbursementId, 2382);
    assert.equal(details.submissions?.[0].treasuryStatus, "Draft");
    assert.equal(details.submissions?.[1].disbursementDocNo, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps Department and Division in returned payable details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    submissionId: 35,
    departmentId: 7,
    canEdit: true,
    lines: [{ id: 101, lineNo: 1, amount: 50, coaId: 2, divisionId: 9, receipts: [] }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const details = await fetchPayableSubmissionDetails(42, 35);
    assert.equal(details.departmentId, 7);
    assert.equal(details.lines[0].divisionId, 9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("includes Department and per-line Division when saving a payable draft", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({
      draft: { id: 35, departmentId: 7, lines: [{ id: 101, amount: 50, divisionId: 9, receipts: [] }] },
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    const draft = await savePayableDraft(42, 7, [{ amount: 50, divisionId: 9 }], "wer-key");
    assert.equal(draft.departmentId, 7);
    assert.equal(draft.lines[0].divisionId, 9);
    assert.deepEqual(JSON.parse(requestBody), {
      action: "save-draft",
      departmentId: 7,
      lines: [{ amount: 50, divisionId: 9 }],
      idempotencyKey: "wer-key",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
