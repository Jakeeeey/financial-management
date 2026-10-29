import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdjustingEntry, AdjustingEntrySummary, AjeAuditEvent } from "../types";
import { actionRequiresReason, actionsForPresentation, AdjustingEntriesTable, availableActions, isEntryPoster } from "./AdjustingEntriesTable";
import { canConfirmSubmission } from "./AjeReviewDialog";
import { AdjustingEntriesSummaryCards } from "./AdjustingEntriesSummaryCards";
import { auditEventSummary } from "./formatters";

function entry(status: AdjustingEntry["status"], overrides: Partial<AdjustingEntry> = {}) {
  return { id: 7, jeNo: "AJE-00007", description: "Accrue utilities", totalDebit: 100, totalCredit: 100,
    variance: 0, transactionDate: "2026-10-26", status, entryOrigin: "MANUAL", creatorId: 24, preparedBy: 25, submittedBy: 26,
    canCancelAfterReversalConflict: false, ...overrides } as AdjustingEntry;
}

function summary(overrides: Partial<AdjustingEntrySummary> = {}): AdjustingEntrySummary {
  return { draft: 2, forRevision: 1, posted: 3, voided: 0, imbalanced: 0, postedImbalanced: 0, totalRecords: 6,
    submitted: 1, approved: 0, rejected: 0, cancelled: 0, failed: 0, postedDebit: 100, postedCredit: 90,
    awaitingMyReview: 0, readyForMeToPost: 0, myDrafts: 0, ...overrides };
}

test("summary KPIs are static while targeted exception investigation remains actionable", () => {
  const cards = renderToStaticMarkup(createElement(AdjustingEntriesSummaryCards, { summary: summary(), showPostedAmounts: true,
    onInvestigatePosted: () => {}, onShowUnbalancedDrafts: () => {} }));
  assert.equal(cards.includes("<button"), false);
  assert.equal(cards.includes("Select a status count"), false);
  assert.equal(cards.includes("Select to view posted journals"), false);
  assert.ok(cards.includes("Posted entries"));
  assert.ok(cards.includes("Awaiting posting"));

  const exceptionCards = renderToStaticMarkup(createElement(AdjustingEntriesSummaryCards, { summary: summary({ imbalanced: 1, postedImbalanced: 1 }),
    showPostedAmounts: true, onInvestigatePosted: () => {}, onShowUnbalancedDrafts: () => {} }));
  assert.ok(exceptionCards.includes("Investigate unbalanced posted journals"));
  assert.ok(exceptionCards.includes("Show unbalanced draft or revisions"));
});

test("drafts and revisions submit, submitted entries post, and approval is retired", () => {
  assert.deepEqual(availableActions(entry("For Revision")), ["submit", "cancel"]);
  assert.deepEqual(availableActions(entry("Draft")), ["submit", "cancel"]);
  assert.ok(availableActions(entry("Submitted")).includes("post"));
  assert.deepEqual(availableActions(entry("Approved")), []);
  assert.deepEqual(availableActions(entry("Posted")), []);
});

test("only resubmitting a revision requires creator notes in addition to reasoned workflow actions", () => {
  assert.equal(actionRequiresReason(entry("For Revision"), "submit"), true);
  assert.equal(actionRequiresReason(entry("Draft"), "submit"), false);
  assert.equal(actionRequiresReason(entry("Submitted"), "reject"), true);
  assert.equal(actionRequiresReason(entry("Draft"), "cancel"), true);
  assert.equal(actionRequiresReason(entry("Submitted"), "post"), false);
});

test("submission preview waits for loaded review data and requires notes only for revisions", () => {
  assert.equal(canConfirmSubmission(entry("Draft"), false, ""), false);
  assert.equal(canConfirmSubmission(entry("Draft"), true, ""), true);
  assert.equal(canConfirmSubmission(entry("For Revision"), true, "  "), false);
  assert.equal(canConfirmSubmission(entry("For Revision"), true, "Addressed the requested change"), true);
  assert.equal(canConfirmSubmission(entry("Submitted"), true, ""), false);
});

test("authorized users may post their own entries regardless of historical approver", () => {
  const submitted = entry("Submitted", { approvedBy: 24 });
  for (const actor of [24, 25, 26]) assert.equal(isEntryPoster(submitted, actor), true);
  assert.equal(isEntryPoster(submitted, undefined), false);
  assert.equal(isEntryPoster(submitted, 27), true);
  assert.equal(isEntryPoster(entry("Submitted", { entryOrigin: "SYSTEM" }), 27), false);
});

test("Creation maintenance actions are shared while Posting retains review actions", () => {
  const submitted = entry("Submitted");
  assert.deepEqual(actionsForPresentation(submitted, 24, true), ["withdraw", "cancel"]);
  assert.deepEqual(actionsForPresentation(submitted, 24, false), ["post", "reject", "reject-final"]);
  assert.deepEqual(actionsForPresentation(submitted, 27, true), ["withdraw", "cancel"]);
  assert.deepEqual(actionsForPresentation(entry("Draft"), 24, true), ["submit", "cancel"]);
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

test("all tables show lifecycle actors and times", () => {
  const lifecycleEntry = entry("Draft", {
    preparedByName: "A. Reyes", preparedAt: "2026-10-27T09:00:00",
    approvedByName: "M. Santos", approvedAt: "2026-10-27T09:30:00",
    rejectedByName: "J. Cruz", rejectedAt: "2026-10-27T10:00:00",
    postedByName: "A. Reyes", datePosted: "2026-10-27T10:30:00",
  });
  const props = { entries: [lifecycleEntry], loading: false, readOnly: true,
    onView: () => {}, onAction: () => {}, onReverse: () => {} };
  const creation = renderToStaticMarkup(createElement(AdjustingEntriesTable, { ...props, presentation: "creation" }));
  const posting = renderToStaticMarkup(createElement(AdjustingEntriesTable, { ...props, presentation: "posting" }));
  const summary = renderToStaticMarkup(createElement(AdjustingEntriesTable, { ...props, presentation: "summary" }));

  for (const view of [creation, posting, summary]) {
    assert.ok(view.includes("Prepared / Reviewed / Posted"));
    assert.ok(view.includes("Prepared:</span> A. Reyes"));
    assert.ok(view.includes("Approved by M. Santos"));
    assert.ok(view.includes("Returned by J. Cruz"));
    assert.ok(view.includes("Posted:</span> A. Reyes"));
  }
});

function withdrawalEvent(overrides: Partial<AjeAuditEvent> = {}): AjeAuditEvent {
  return { id: 1, entryId: 7, journalNumber: "AJE-00007", currentEntryAvailable: true,
    currentReference: "UTILITY-ACCRUAL", originalJournalNumber: null, originalReference: null,
    actorUserId: 24, actorName: "Creator", action: "Withdrawn", status: "Posted",
    occurredAt: "2026-10-27T09:00:00", reason: null, currentTotalDebit: 100, currentTotalCredit: 100,
    changes: [{ field: "Status", before: "Submitted", after: "Draft" }], ...overrides };
}

test("withdrawal audit describes the recorded Draft destination rather than today's journal status", () => {
  assert.equal(auditEventSummary(withdrawalEvent()), "Withdrawn to Draft");
});

test("historical withdrawal destinations remain accurate after the workflow changes", () => {
  assert.equal(auditEventSummary(withdrawalEvent({ status: "Draft",
    changes: [{ field: "Status", before: "Submitted", after: "For Revision" }] })), "Withdrawn for revision");
});

test("withdrawal events without a recorded destination use neutral wording", () => {
  assert.equal(auditEventSummary(withdrawalEvent({ status: "Draft", changes: [] })), "Submission withdrawn");
});

test("withdrawal audit retains explicitly recorded reasons", () => {
  assert.equal(auditEventSummary(withdrawalEvent({ reason: "  Correct the reference  " })), "Correct the reference");
});

test("final rejection is terminal and posting excludes creator maintenance actions", () => {
  assert.deepEqual(availableActions(entry("Rejected", { finallyRejected: true })), []);
  assert.deepEqual(actionsForPresentation(entry("Submitted"), 24, false), ["post", "reject", "reject-final"]);
  assert.equal(actionRequiresReason(entry("Submitted"), "reject-final"), true);
  assert.ok(availableActions(entry("Rejected")).includes("revise"));
});

test("another authorized user can submit drafts and revisions", () => {
  assert.deepEqual(actionsForPresentation(entry("Draft"), 27, true), ["submit", "cancel"]);
  assert.deepEqual(actionsForPresentation(entry("For Revision"), 27, true), ["submit", "cancel"]);
  assert.deepEqual(actionsForPresentation(entry("Posted"), 27, true), []);
});
