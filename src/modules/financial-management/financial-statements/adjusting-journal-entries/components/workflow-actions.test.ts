import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdjustingEntry } from "../types";
import { AdjustingEntriesTable, availableActions, isEntryPoster } from "./AdjustingEntriesTable";

function entry(status: AdjustingEntry["status"], overrides: Partial<AdjustingEntry> = {}) {
  return { id: 7, jeNo: "AJE-00007", description: "Accrue utilities", totalDebit: 100, totalCredit: 100,
    variance: 0, transactionDate: "2026-10-26", status, entryOrigin: "MANUAL", creatorId: 24, preparedBy: 25, submittedBy: 26,
    canCancelAfterReversalConflict: false, ...overrides } as AdjustingEntry;
}

test("drafts and revisions submit, submitted entries post, and approval is retired", () => {
  assert.deepEqual(availableActions(entry("For Revision")), ["submit", "cancel"]);
  assert.deepEqual(availableActions(entry("Draft")), ["submit", "cancel"]);
  assert.ok(availableActions(entry("Submitted")).includes("post"));
  assert.deepEqual(availableActions(entry("Approved")), []);
  assert.deepEqual(availableActions(entry("Posted")), []);
});

test("only an independent user may post regardless of historical approver", () => {
  const submitted = entry("Submitted", { approvedBy: 24 });
  for (const actor of [24, 25, 26, undefined]) assert.equal(isEntryPoster(submitted, actor), false);
  assert.equal(isEntryPoster(submitted, 27), true);
  assert.equal(isEntryPoster(entry("Submitted", { entryOrigin: "SYSTEM" }), 27), false);
});

test("failed reversal conflicts cannot retry and system entries expose no manual actions", () => {
  assert.deepEqual(availableActions(entry("Failed", { canCancelAfterReversalConflict: true })), ["cancel"]);
  assert.ok(availableActions(entry("Failed")).includes("retry"));
  assert.deepEqual(availableActions(entry("For Revision", { entryOrigin: "SYSTEM" })), []);
});

test("Creation tracks submissions without exposing posting and Posting offers an individual review action", () => {
  const props = { entries: [entry("Submitted")], loading: false, userId: 27, readOnly: false,
    onView: () => {}, onAction: () => {}, onReverse: () => {} };
  const creation = renderToStaticMarkup(createElement(AdjustingEntriesTable, { ...props, presentation: "creation" }));
  const posting = renderToStaticMarkup(createElement(AdjustingEntriesTable, { ...props, presentation: "posting" }));
  assert.ok(creation.includes("Submitted"));
  assert.equal(creation.includes(">Post</button>"), false);
  assert.ok(posting.includes(">Post</button>"));
  assert.equal(posting.includes("Approve selected"), false);
});
