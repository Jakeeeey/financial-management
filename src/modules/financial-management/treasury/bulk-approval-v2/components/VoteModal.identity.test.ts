import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(new URL("./VoteModal.tsx", import.meta.url), "utf8");

test("the Salesman card renders the expense encoder identity", () => {
  const salesmanCard = modalSource.match(
    /Salesman<\/p>[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex items-center gap-3 pl-4/
  );

  assert.ok(salesmanCard, "Salesman identity card was not found");
  assert.match(salesmanCard[0], /draft\.encoder_name/);
  assert.match(salesmanCard[0], /draft\.encoder_user_id/);
  assert.doesNotMatch(salesmanCard[0], /draft\.payee_(?:name|user_id)/);
});
