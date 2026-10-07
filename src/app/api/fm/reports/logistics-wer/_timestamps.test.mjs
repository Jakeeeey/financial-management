import assert from "node:assert/strict";
import test from "node:test";
import { formatManilaWallClock } from "./_timestamps.ts";

test("formats timestamps as Philippine wall-clock time without a timezone suffix", () => {
  assert.equal(formatManilaWallClock(new Date("2026-10-01T11:20:41.000Z")), "2026-10-01T19:20:41");
});

test("uses the Philippine calendar date when UTC time crosses midnight locally", () => {
  assert.equal(formatManilaWallClock(new Date("2026-10-01T16:00:00.000Z")), "2026-10-02T00:00:00");
});
