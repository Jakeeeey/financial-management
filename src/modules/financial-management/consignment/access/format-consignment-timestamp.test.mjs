import assert from "node:assert/strict";
import test from "node:test";
import { formatConsignmentTimestamp } from "./format-consignment-timestamp.ts";

test("formats Manila-local timestamps as PH wall-clock time", () => {
  assert.equal(
    formatConsignmentTimestamp("2026-10-15T09:01:32"),
    formatConsignmentTimestamp("2026-10-15T01:01:32Z"),
  );
});

test("does not append a second timezone to an offset-bearing timestamp", () => {
  assert.equal(
    formatConsignmentTimestamp("2026-10-15T09:01:32+08:00"),
    formatConsignmentTimestamp("2026-10-15T01:01:32Z"),
  );
});
