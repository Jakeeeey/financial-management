import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./VoteModal.tsx", import.meta.url), "utf8");

test("VoteModal collects remarks after Submit Decision and confirms before submitting", () => {
  const footer = source.match(/\{\/\* Footer Section Pattern \*\/\}[\s\S]*?Cancel Review/);
  assert.ok(footer, "VoteModal footer was not found");
  assert.doesNotMatch(footer[0], /<Textarea/);
  assert.match(footer[0], /setRemarksOpen\(true\)/);

  assert.match(source, /<Dialog open=\{remarksOpen\}/);
  assert.match(source, /Approval Remarks/);
  assert.match(source, /Finalize Decision/);
  assert.match(source, /<Dialog\s+open=\{showApproveConfirm\}/);
  assert.match(source, /onClick=\{\(\) => executeSubmit\(pendingRemarks\.current\)\}/);
});
