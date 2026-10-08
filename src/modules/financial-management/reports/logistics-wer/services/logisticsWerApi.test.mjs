import assert from "node:assert/strict";
import test from "node:test";
import { fetchLogisticsWerDetails } from "./logisticsWerApi.ts";

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
