import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSource = readFileSync(
  new URL("./myLevelApproval.service.ts", import.meta.url),
  "utf8"
);

test("bulk approval evidence comes only from expense_draft attachment_url", () => {
  assert.doesNotMatch(
    serviceSource,
    /items\/expense_attachments/,
    "header-level expense_attachments must not feed VoteModal evidence"
  );
  assert.match(serviceSource, /expense_id\.attachment_url/);
  assert.match(serviceSource, /rawConcerns/);
});
