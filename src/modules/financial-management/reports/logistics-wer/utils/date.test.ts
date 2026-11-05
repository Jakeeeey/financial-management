import assert from "node:assert/strict";
import test from "node:test";
import { todayManilaDate, formatWerTimestamp } from "./date";
test("expense defaults use the Philippine calendar across UTC midnight", () => {
  assert.equal(todayManilaDate(new Date("2026-10-01T15:59:59Z")), "2026-10-01");
  assert.equal(todayManilaDate(new Date("2026-10-01T16:00:00Z")), "2026-10-02");
});
test("audit displays explicitly identify Philippine time", () => {
  assert.equal(formatWerTimestamp("2026-10-01T11:20:41Z"), formatWerTimestamp("2026-10-01T19:20:41+08:00"));
  assert.equal(formatWerTimestamp("2026-10-01 19:20:41"), formatWerTimestamp("2026-10-01T19:20:41+08:00"));
  assert.ok(formatWerTimestamp("2026-10-01T11:20:41Z").endsWith("PHT (UTC+08:00)"));
});
