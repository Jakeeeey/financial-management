import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(
  new URL("./ExpenseApprovalModal.tsx", import.meta.url),
  "utf8"
);

test("line-item evidence remains clickable in view-only headers", () => {
  const evidenceButton = modalSource.match(
    /<Button\s+type="button"\s+size="icon"\s+variant="ghost"\s+className="h-8 w-8 bg-blue-50[\s\S]*?showAttachment\([\s\S]*?<\/Button>/
  );

  assert.ok(evidenceButton, "line-item evidence button was not found");
  assert.doesNotMatch(
    evidenceButton[0],
    /disabled=/,
    "read-only evidence must not inherit the decision-processing lock"
  );
  assert.match(
    evidenceButton[0],
    /setFocusedPreviewUrl/,
    "the line-item Docs action must open a focused preview dialog"
  );
});

test("line items without evidence show a no-attachment tag", () => {
  assert.match(modalSource, /No attachment/);
  assert.match(modalSource, /expense\.attachment_url\s*\?/);
});
