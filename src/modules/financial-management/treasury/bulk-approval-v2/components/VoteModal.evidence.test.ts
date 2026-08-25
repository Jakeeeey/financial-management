import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(new URL("./VoteModal.tsx", import.meta.url), "utf8");

test("line-item evidence remains clickable when voting controls are locked", () => {
  const evidenceButton = modalSource.match(
    /<Button\s+type="button"\s+size="icon"\s+variant="ghost"\s+className="h-8 w-8 bg-blue-50[\s\S]*?setPreviewUrl\([\s\S]*?<\/Button>/
  );

  assert.ok(evidenceButton, "line-item evidence button was not found");
  assert.doesNotMatch(
    evidenceButton[0],
    /disabled=/,
    "evidence preview must not inherit voting-control locks"
  );
});
