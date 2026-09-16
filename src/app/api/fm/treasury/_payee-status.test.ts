/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves local .ts modules through CommonJS. */
import type {} from "node:assert/strict";
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const test: typeof import("node:test") = require("node:test");
const { isEffectivelyActivePayee } = require("./_payee-status.ts") as typeof import("./_payee-status");

test("treats active and legacy-null payees as active", () => {
    assert.equal(isEffectivelyActivePayee(true), true);
    assert.equal(isEffectivelyActivePayee(1), true);
    assert.equal(isEffectivelyActivePayee("1"), true);
    assert.equal(isEffectivelyActivePayee(null), true);
    assert.equal(isEffectivelyActivePayee(undefined), true);
});

test("treats explicit inactive values as inactive", () => {
    assert.equal(isEffectivelyActivePayee(false), false);
    assert.equal(isEffectivelyActivePayee(0), false);
    assert.equal(isEffectivelyActivePayee("0"), false);
});
