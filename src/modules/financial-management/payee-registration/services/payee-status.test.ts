/* eslint-disable @typescript-eslint/no-require-imports -- Node's strip-types runner resolves local .ts modules through CommonJS. */
import type {} from "node:assert/strict";

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const test: typeof import("node:test") = require("node:test");

process.env.NEXT_PUBLIC_API_BASE_URL = "http://directus.test";
process.env.DIRECTUS_STATIC_TOKEN = "test-token";

const { createPayee, updatePayee } = require("./payee.ts") as typeof import("./payee");

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("new payees are active while updates preserve omitted status", async () => {
  const payloads: Record<string, unknown>[] = [];
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    payloads.push(body);
    return new Response(JSON.stringify({ data: { ...body, id: 1 } }), { status: 200 });
  };

  await createPayee({
    supplier_name: "Test Payee",
    supplier_type: "NON-TRADE",
    tin_number: "123456789",
  });
  await updatePayee(1, {
    supplier_name: "Test Payee",
    supplier_type: "NON-TRADE",
    tin_number: "123456789",
  });
  await updatePayee(1, {
    supplier_name: "Test Payee",
    supplier_type: "NON-TRADE",
    tin_number: "123456789",
    isActive: 0,
  });

  await updatePayee(1, { isActive: 0 });

  assert.equal(payloads[0].isActive, 1);
  assert.equal("isActive" in payloads[1], false);
  assert.equal(payloads[2].isActive, 0);
  assert.deepEqual(payloads[3], { isActive: 0 });
});
