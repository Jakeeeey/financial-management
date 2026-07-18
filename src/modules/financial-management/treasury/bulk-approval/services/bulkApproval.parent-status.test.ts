import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./bulkApproval.shared.ts", import.meta.url),
  "utf8"
);

test("line-level concern does not make the disbursement draft terminal", () => {
  const terminalBranch = source.match(
    /if \(finalVoteStatus === "REJECTED"[\s\S]*?return \{ ok: true, result: finalVoteStatus, message: "Draft updated\." \};\s*\}/
  );

  assert.ok(terminalBranch, "terminal parent-draft branch was not found");
  assert.doesNotMatch(
    terminalBranch[0],
    /finalVoteStatus === "WITH_CONCERN"/
  );
  assert.match(terminalBranch[0], /remainingCount <= 0/);
});
