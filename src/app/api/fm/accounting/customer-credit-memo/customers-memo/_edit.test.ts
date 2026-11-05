/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves the local .ts module through CommonJS. */
import type {} from "node:assert/strict";

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const test: typeof import("node:test") = require("node:test");

process.env.NEXT_PUBLIC_API_BASE_URL = "http://directus.test";
process.env.DIRECTUS_STATIC_TOKEN = "test-token";

const {
    canEditPendingCreditMemo,
    hasCustomerMemoListAccess,
    requireCustomerMemoModuleAccess,
} = require("./_edit.ts") as typeof import("./_edit");

const originalFetch = globalThis.fetch;

function directusResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify({ data }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function sessionRequest(userId = 42, expiresAt = Math.floor(Date.now() / 1000) + 60) {
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString("base64url");
    const token = "header." + payload + ".signature";
    return {
        cookies: {
            get: (name: string) => name === "vos_access_token" ? { value: token } : undefined,
        },
    };
}

function mockAccess({
    user = {},
    modules = [],
    moduleStatus = 200,
}: {
    user?: Record<string, unknown>;
    modules?: unknown[];
    moduleStatus?: number;
} = {}): void {
    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/items/user/")) return directusResponse(user);
        if (url.includes("/items/user_access_modules")) return directusResponse(modules, moduleStatus);
        return directusResponse([], 404);
    };
}

test.afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("only pending credit memos are eligible for editing", () => {
    assert.equal(canEditPendingCreditMemo("FOR APPROVAL", 1), true);
    assert.equal(canEditPendingCreditMemo("REJECTED", 1), false);
    assert.equal(canEditPendingCreditMemo("APPROVED", 1), false);
    assert.equal(canEditPendingCreditMemo("APPLIED", 1), false);
    assert.equal(canEditPendingCreditMemo("FOR APPROVAL", 2), false);
});

test("matches exact and parent Customer Memo module paths, but not unrelated or empty paths", () => {
    assert.equal(hasCustomerMemoListAccess([
        { module_id: { base_path: "/fm/accounting/customer-credit-memo/customer-memo-list" } },
    ]), true);
    assert.equal(hasCustomerMemoListAccess([
        { module_id: { base_path: "/fm/accounting/customer-credit-memo" } },
    ]), true);
    assert.equal(hasCustomerMemoListAccess([
        { module_id: { base_path: "/fm/accounting/other-module" } },
        { module_id: { base_path: "" } },
    ]), false);
});

test("rejects missing and expired sessions", async () => {
    const missing = await requireCustomerMemoModuleAccess({ cookies: { get: () => undefined } });
    const expired = await requireCustomerMemoModuleAccess(sessionRequest(42, 1));
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 401);
    assert.equal(expired.ok, false);
    assert.equal(expired.status, 401);
});

test("allows a signed-in user with Customer Memo module access", async () => {
    mockAccess({
        user: { role: "USER", isAdmin: false },
        modules: [{ module_id: { base_path: "/fm/accounting/customer-credit-memo" } }],
    });

    const result = await requireCustomerMemoModuleAccess(sessionRequest());
    assert.deepEqual(result, { ok: true, userId: 42 });
});

test("allows administrators and rejects users without the module", async () => {
    mockAccess({ user: { role: "ADMIN", isAdmin: true } });
    assert.deepEqual(await requireCustomerMemoModuleAccess(sessionRequest()), { ok: true, userId: 42 });

    mockAccess({
        user: { role: "USER", isAdmin: false },
        modules: [{ module_id: { base_path: "/fm/accounting/other-module" } }],
    });
    const denied = await requireCustomerMemoModuleAccess(sessionRequest());
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
});

test("fails closed when Directus cannot resolve access", async () => {
    mockAccess({
        user: { role: "USER", isAdmin: false },
        moduleStatus: 503,
    });
    const result = await requireCustomerMemoModuleAccess(sessionRequest());
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
});
