/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves the local .ts module through CommonJS. */
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const test: typeof import("node:test") = require("node:test");

process.env.NEXT_PUBLIC_API_BASE_URL = "http://directus.test";
process.env.DIRECTUS_STATIC_TOKEN = "test-token";

const {
    hasDisbursementApprovalAccess,
    isDisbursementApprovalModule,
} = require("./_approval-access.ts");

const originalFetch = globalThis.fetch;

function directusResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify({ data }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
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

test("recognizes the cash issuance approval base path with the generic approval slug", () => {
    assert.equal(isDisbursementApprovalModule({
        slug: "approval",
        base_path: "/fm/treasury/cash-issuance/approval",
    }), true);
});

test("allows a regular user with the exact approval module access", async () => {
    mockAccess({
        user: { role: "USER", isAdmin: false },
        modules: [{ module_id: { slug: "approval", base_path: "/fm/treasury/cash-issuance/approval" } }],
    });

    assert.equal(await hasDisbursementApprovalAccess(1044), true);
});

test("preserves legacy composite approval slugs", () => {
    assert.equal(isDisbursementApprovalModule({ slug: "cash-issuance-approval" }), true);
});

test("rejects an unrelated approval path", async () => {
    mockAccess({
        user: { role: "USER", isAdmin: false },
        modules: [{ module_id: { slug: "approval", base_path: "/fm/treasury/expense-approval" } }],
    });

    assert.equal(await hasDisbursementApprovalAccess(1044), false);
});

test("keeps administrator access independent of module rows", async () => {
    mockAccess({
        user: { role: "ADMIN", isAdmin: true },
        modules: [],
    });

    assert.equal(await hasDisbursementApprovalAccess(370), true);
});

test("fails closed when the module access lookup fails", async () => {
    mockAccess({
        user: { role: "USER", isAdmin: false },
        moduleStatus: 500,
    });

    assert.equal(await hasDisbursementApprovalAccess(1044), false);
});
