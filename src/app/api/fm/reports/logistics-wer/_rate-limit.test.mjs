import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const filename = path.resolve(file);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (name in overrides) return overrides[name];
    if (name.startsWith("@/") || name.startsWith(".")) return load((name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(filename), name)) + ".ts", overrides);
    return require(name);
  }, exports);
  return exports;
}


const directory = "src/app/api/fm/reports/logistics-wer";
test("429 contract preserves retry interval while keeping applied writes successful", () => {
  const api = load(`${directory}/_errors.ts`);
  const dependency = api.dependencyFromResponse(new Response("Too many requests", { status: 429, headers: { "Retry-After": "12" } }), "spring");
  const response = api.werFailureResponse(dependency);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "12");
  assert.equal(api.publicWerFailure(dependency).code, "WER_RATE_LIMITED");
  assert.equal(api.werFailureResponse(dependency, "applied").status, 200);
});

test("module coordinator coalesces reads and blocks subsequent writes during cooldown without replay", async () => {
  const api = load("src/modules/financial-management/reports/logistics-wer/services/wer-requests.ts");
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("Too many requests", { status: 429, headers: { "Retry-After": "1" } }); };
  try {
    const responses = await Promise.all([api.werFetch("http://test.invalid/report"), api.werFetch("http://test.invalid/report")]);
    assert.equal(calls, 1);
    assert.equal(await responses[0].text(), "Too many requests");
    assert.equal(await responses[1].text(), "Too many requests");
    await assert.rejects(api.werFetch("http://test.invalid/action", { method: "POST" }), error => error.outcome === "not_applied");
    assert.equal(calls, 1);
    await new Promise(resolve => setTimeout(resolve, 1050));
    assert.equal(calls, 1, "no automatic retry at expiry");
    await api.werFetch("http://test.invalid/action", { method: "POST" });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});


test("shared Spring proxy forwards Retry-After without retrying a 429", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ message: "Too many requests" }, { status: 429, headers: { "Retry-After": "9" } }); };
  class MockResponse extends Response { static json = Response.json; }
  try {
    const proxy = load("src/app/api/fm/financial-statements/adjusting-journal-entries/_spring.ts", {
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "next/server": { NextResponse: MockResponse },
    });
    const response = await proxy.proxySpring("/api/v1/dispatch-approval/1", undefined, "test-token");
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "9");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("cooldown scopes isolate users and keep same-user deadlines across navigation", async () => {
  const originalFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const data = new Map();
  globalThis.window = { addEventListener: () => {} };
  globalThis.localStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  globalThis.fetch = async () => new Response("Too many requests", { status: 429, headers: { "Retry-After": "10" } });
  try {
    const api = load("src/modules/financial-management/reports/logistics-wer/services/wer-requests.ts");
    api.setWerScope("user-a");
    await api.werFetch("http://test.invalid/report");
    const deadline = api.cooldownSnapshot();
    api.setWerScope("user-b");
    assert.equal(api.cooldownSnapshot(), 0);
    api.setWerScope("user-a");
    assert.equal(api.cooldownSnapshot(), deadline);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
});


test("payable 429 responses preserve the retry interval for each mutation outcome", async () => {
  const errors = load(`${directory}/_errors.ts`);
  for (const phase of ["before", "write", "after"]) {
    let written = false;
    const fail = () => new errors.WerDependencyError(429, "DIRECTUS_HTTP_429", 8);
    const api = load(`${directory}/[dispatchPlanId]/payables/route.ts`, {
      "../../_errors": errors,
      "../../_payables": {
        DRAFT_COLLECTION: "drafts", BudgetContextError: class extends Error {},
        requireSessionUserId: async () => 2, withPlanLock: async (_, task) => task(),
        getPlanBaseline: async () => ({ status: "For Clearance" }),
        getPlanSubmission: async () => {
          if (phase === "before" || (phase === "after" && written)) throw fail();
          return { planId: 1, submission: { id: 3, status: "submitted", submittedBy: 2 } };
        },
        directusWrite: async () => { if (phase === "write") throw fail(); written = true; },
        markWerPlanLiquidatedIfSettled: async () => {},
      },
      "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    });
    const response = await api.POST({ json: async () => ({ action: "withdraw", submissionId: 3 }) }, { params: Promise.resolve({ dispatchPlanId: "1" }) });
    assert.equal(response.status, phase === "after" ? 200 : 429);
    assert.equal(response.headers.get("Retry-After"), "8");
    const payload = await response.json();
    assert.equal(payload.code, "WER_RATE_LIMITED");
    assert.equal(payload.outcome, phase === "before" ? "not_applied" : phase === "write" ? "unknown" : "applied");
  }
});

test("Spring budget verification retains 429 instead of wrapping it as a generic budget failure", async () => {
  const api = load(`${directory}/_payables.ts`, {
    "next/server": {}, "next/headers": {}, "@/lib/auth-utils": {},
    "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring": {
      proxySpring: async () => Response.json({ message: "Too many requests" }, { status: 429, headers: { "Retry-After": "4" } }),
    },
  });
  await assert.rejects(api.getPlanBudgetLines(1), error => error.upstreamStatus === 429 && error.retryAfterSeconds === 4);
});
