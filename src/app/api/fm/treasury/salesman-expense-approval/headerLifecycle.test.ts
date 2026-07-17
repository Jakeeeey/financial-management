/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves the local .ts module through CommonJS. */
const lifecycleAssert: typeof import("node:assert/strict") = require("node:assert/strict");
const lifecycleTest: typeof import("node:test") = require("node:test");
const {
  deriveTerminalHeaderStatus,
  filterHeadersByScope,
  getEffectiveHeaderStatus,
  isPendingHeader,
} = require("./headerLifecycle.ts") as typeof import("./headerLifecycle");

lifecycleTest("derives Approved when every item is approved or posted", () => {
  lifecycleAssert.equal(
    deriveTerminalHeaderStatus(["Approved", "Posted", "approved"]),
    "Approved"
  );
});

lifecycleTest("derives Rejected when every item is rejected", () => {
  lifecycleAssert.equal(deriveTerminalHeaderStatus(["Rejected", "rejected"]), "Rejected");
});

lifecycleTest("does not derive a terminal header for mixed or active item statuses", () => {
  lifecycleAssert.equal(deriveTerminalHeaderStatus(["Approved", "Rejected"]), null);
  lifecycleAssert.equal(deriveTerminalHeaderStatus(["Approved", "With Concern"]), null);
  lifecycleAssert.equal(deriveTerminalHeaderStatus([]), null);
});

lifecycleTest("keeps only non-terminal headers with active items pending", () => {
  lifecycleAssert.equal(isPendingHeader("Drafts", ["Approved", "With Concern"]), true);
  lifecycleAssert.equal(isPendingHeader("Approved", ["Drafts"]), false);
  lifecycleAssert.equal(isPendingHeader("Posted", ["With Concern"]), false);
  lifecycleAssert.equal(isPendingHeader("Rejected", ["Drafts"]), false);
  lifecycleAssert.equal(isPendingHeader("Drafts", ["Approved", "Rejected"]), false);
});

lifecycleTest("filters submission headers by pending, history, and all scopes", () => {
  const headers = [
    { id: 1, status: "Drafts" },
    { id: 2, status: "Approved" },
    { id: 3, status: "Posted" },
    { id: 4, status: "Rejected" },
    { id: 5, status: "Drafts" },
  ];
  const expenses = [
    { header_id: 1, status: "With Concern" },
    { header_id: 2, status: "Approved" },
    { header_id: 3, status: "Approved" },
    { header_id: 4, status: "Rejected" },
    { header_id: 5, status: "Approved" },
  ];

  lifecycleAssert.deepEqual(
    filterHeadersByScope(headers, expenses, "pending").map((header) => header.id),
    [1]
  );
  lifecycleAssert.deepEqual(
    filterHeadersByScope(headers, expenses, "history").map((header) => header.id),
    [2, 3, 4, 5]
  );
  lifecycleAssert.deepEqual(
    filterHeadersByScope(headers, expenses, "all").map((header) => header.id),
    [1, 2, 3, 4, 5]
  );
});

lifecycleTest("derives an effective terminal status for a stale parent header", () => {
  lifecycleAssert.equal(getEffectiveHeaderStatus("Drafts", ["Approved"]), "Approved");
  lifecycleAssert.equal(getEffectiveHeaderStatus("Drafts", ["Rejected"]), "Rejected");
  lifecycleAssert.equal(getEffectiveHeaderStatus("Posted", ["Approved"]), "Posted");
});
