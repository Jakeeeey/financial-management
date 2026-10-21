import assert from "node:assert/strict";
import { test } from "node:test";
import { getTrialBalanceReviewLabel, getTrialBalanceReviewReason } from "./review-flags";

test("review flag values display as review prompts rather than severity claims", () => {
  assert.equal(getTrialBalanceReviewLabel("Critical"), "Needs review");
  assert.equal(getTrialBalanceReviewLabel("Normal"), "No flag");
  assert.equal(getTrialBalanceReviewLabel("High"), "Review status unavailable");
});

test("missing reasons are explicit only for accounts that need review", () => {
  assert.equal(getTrialBalanceReviewReason("Critical", "  unusual movement  "), "unusual movement");
  assert.equal(getTrialBalanceReviewReason("Critical"), "Review reason unavailable.");
  assert.equal(getTrialBalanceReviewReason("Normal"), null);
});
