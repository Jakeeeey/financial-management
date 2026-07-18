import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSources = [
  "./VoteModal.tsx",
  "./AuditeeDetailSplitModal.tsx",
  "../../salesmen-expense-approval/components/ExpenseApprovalModal.tsx",
].map((path) => ({
  path,
  source: readFileSync(new URL(path, import.meta.url), "utf8"),
}));

test("approval views contain only expense evidence UI", () => {
  for (const component of componentSources) {
    assert.doesNotMatch(
      component.source,
      /\bWER\b|WerExpense|attachments_query_ok|missingHeaders|werAttachments|evidenceViewer/,
      `${component.path} still contains WER-only UI`
    );
  }
});
