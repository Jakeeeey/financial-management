import assert from "node:assert/strict";
import test from "node:test";
import { formatManilaWallClock, serializeManilaTimestamp, toManilaWallClock } from "./_timestamps.ts";

test("formats timestamps as Philippine wall-clock time without a timezone suffix", () => {
  assert.equal(formatManilaWallClock(new Date("2026-10-01T11:20:41.000Z")), "2026-10-01T19:20:41");
});

test("uses the Philippine calendar date when UTC time crosses midnight locally", () => {
  assert.equal(formatManilaWallClock(new Date("2026-10-01T16:00:00.000Z")), "2026-10-02T00:00:00");
});

test("serializes wall-clock and explicit instants with a Philippine offset", () => {
  assert.equal(serializeManilaTimestamp("2026-10-01 19:20:41"), "2026-10-01T19:20:41+08:00");
  assert.equal(serializeManilaTimestamp("2026-10-01T11:20:41Z"), "2026-10-01T19:20:41+08:00");
  assert.equal(serializeManilaTimestamp("2026-10-01T16:00:00Z"), "2026-10-02T00:00:00+08:00");
  assert.equal(toManilaWallClock("2026-10-01T19:20:41+08:00"), "2026-10-01T19:20:41");
  assert.equal(serializeManilaTimestamp(null), null);
  assert.equal(serializeManilaTimestamp("invalid"), null);
});
