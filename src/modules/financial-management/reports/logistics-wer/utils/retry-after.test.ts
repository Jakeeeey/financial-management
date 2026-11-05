import assert from "node:assert/strict";
import test from "node:test";
import { retryAfterSeconds } from "./retry-after";

test("retry interval supports seconds and HTTP dates with a safe fallback", () => {
  const now = Date.parse("2026-10-29T00:00:00Z");
  assert.equal(retryAfterSeconds("7", now), 7);
  assert.equal(retryAfterSeconds("Thu, 29 Oct 2026 00:00:12 GMT", now), 12);
  for (const invalid of [null, "garbage", "-1", "0", "Thu, 29 Oct 2026 00:00:00 GMT"]) assert.equal(retryAfterSeconds(invalid, now), 10);
});
