import assert from "node:assert/strict";
import { test } from "node:test";
import { formatQueueAgeLabel } from "./formatters";

test("queue age labels state the pending action and elapsed event age", () => {
  assert.equal(formatQueueAgeLabel("Submitted", 30_000), "Awaiting posting · Submitted less than a minute ago");
  assert.equal(formatQueueAgeLabel("Approved", 30_000), "Awaiting posting · Approved less than a minute ago");
  assert.equal(formatQueueAgeLabel("Failed", 30_000), "Retry posting · Last attempt less than a minute ago");
  assert.equal(formatQueueAgeLabel("Failed", 30_000, false), "Posting failed · Last attempt less than a minute ago");
});

test("queue age labels use readable elapsed units with singular and plural forms", () => {
  assert.equal(formatQueueAgeLabel("Submitted", 60_000), "Awaiting posting · Submitted 1 minute ago");
  assert.equal(formatQueueAgeLabel("Approved", 65 * 60_000), "Awaiting posting · Approved 1 hour 5 minutes ago");
  assert.equal(formatQueueAgeLabel("Failed", 2 * 1_440 * 60_000 + 3 * 60 * 60_000), "Retry posting · Last attempt 2 days 3 hours ago");
});

test("future timestamps retain the existing zero-age behavior", () => {
  assert.equal(formatQueueAgeLabel("Approved", -1), "Awaiting posting · Approved less than a minute ago");
});
