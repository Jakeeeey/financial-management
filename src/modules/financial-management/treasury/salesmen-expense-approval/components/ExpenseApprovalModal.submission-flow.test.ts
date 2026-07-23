import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ExpenseApprovalModal.tsx", import.meta.url), "utf8");

test("ExpenseApprovalModal confirms after collecting approval remarks", () => {
  assert.match(source, /<Dialog open=\{confirmOpen\}/);
  assert.match(source, /Approval Remarks/);
  assert.match(source, /Finalize Decision/);
  assert.match(source, /setFinalConfirmOpen\(true\)/);
  assert.match(source, /<Dialog\s+open=\{finalConfirmOpen\}/);

  const finalConfirmation = source.match(
    /<Dialog\s+open=\{finalConfirmOpen\}[\s\S]*?<\/Dialog>/
  );
  assert.ok(finalConfirmation, "final confirmation dialog was not found");
  assert.match(finalConfirmation[0], /onClick=\{handleConfirm\}/);
});
