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
const errors = load(`${directory}/_errors.ts`);
const busy = () => new errors.WerDependencyError(503, "SERVICE_UNAVAILABLE", 10);
const responseMock = { NextResponse: { json: (body, init) => Response.json(body, init) } };

test("mutation outcomes distinguish unavailable reads, uncertain writes and successful writes followed by failed reload", async () => {
  for (const phase of ["before", "write", "after", "success"]) {
    let written = false;
    const dependencies = {
      DRAFT_COLLECTION: "drafts", BudgetContextError: class extends Error {},
      requireSessionUserId: async () => 2, withPlanLock: async (_, task) => task(),
      getPlanBaseline: async () => ({ status: "For Clearance" }),
      getPlanSubmission: async () => {
        if (phase === "before" || (phase === "after" && written)) throw busy();
        return { planId: 1, submission: { id: 3, status: written ? "withdrawn" : "submitted", submittedBy: 2 } };
      },
      directusWrite: async () => { if (phase === "write") throw busy(); written = true; },
      markWerPlanLiquidatedIfSettled: async () => {},
    };
    const api = load(`${directory}/[dispatchPlanId]/payables/route.ts`, {
      "../../_payables": dependencies, "../../_errors": errors, "next/server": responseMock,
    });
    const response = await api.POST({ json: async () => ({ action: "withdraw", submissionId: 3 }) }, { params: Promise.resolve({ dispatchPlanId: "1" }) });
    const result = await response.json();
    if (phase === "success") { assert.equal(result.draft.status, "withdrawn"); continue; }
    assert.equal(response.status, phase === "after" ? 200 : 503);
    assert.equal(result.outcome, phase === "before" ? "not_applied" : phase === "write" ? "unknown" : "applied");
    assert.doesNotMatch(JSON.stringify(result), /SERVICE_UNAVAILABLE|Under pressure|Directus request failed/);
    assert.ok(result.requestId);
  }
});

test("Directus JSON and non-JSON failures are sanitized; locks serialize and release", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const oldToken = process.env.DIRECTUS_STATIC_TOKEN;
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://test.invalid";
  process.env.DIRECTUS_STATIC_TOKEN = "test";
  const api = load(`${directory}/_payables.ts`, {
    "next/server": {}, "next/headers": {}, "@/lib/auth-utils": {},
    "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring": {},
  });
  try {
    for (const body of ["Under pressure", JSON.stringify({ errors: [{ extensions: { code: "SERVICE_UNAVAILABLE" } }] })]) {
      globalThis.fetch = async () => new Response(body, { status: 503 });
      await assert.rejects(api.directusFetch("/items/test"), error => /temporarily busy/.test(error.message) && !error.message.includes(body));
    }
    const calls = [];
    globalThis.fetch = async url => { calls.push(new URL(url).pathname); return Response.json({ data: [] }); };
    await api.getPlanFinancialContext(1, true, []);
    assert.equal(calls.filter(url => url.endsWith("/disbursement_logistics_draft")).length, 1, "summary and accounting share one metadata read");
    const order = [];
    await Promise.all([api.withPlanLock(1, async () => { order.push(1); await Promise.resolve(); order.push(2); }), api.withPlanLock(1, async () => { order.push(3); })]);
    assert.deepEqual(order, [1, 2, 3]);
    await api.withPlanLock(1, async () => { throw new Error("test"); }).catch(() => {});
    await api.withPlanLock(1, async () => order.push(4));
    assert.equal(order.at(-1), 4);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.DIRECTUS_STATIC_TOKEN; else process.env.DIRECTUS_STATIC_TOKEN = oldToken;
  }
});

test("concurrent detail refreshes share one request and subsequent refresh stays fresh", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ id: 1, budgets: [] }); };
  try {
    const api = load("src/modules/financial-management/reports/logistics-wer/services/logisticsWerApi.ts");
    await Promise.all([api.fetchLogisticsWerDetails(1), api.fetchLogisticsWerDetails(1)]);
    assert.equal(calls, 1);
    await api.fetchLogisticsWerDetails(1);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});


test("failed update and failed compensation return unknown instead of implying unchanged data", async () => {
  let writes = 0;
  const dependencies = {
    DRAFT_COLLECTION: "drafts", DRAFT_LINE_COLLECTION: "lines", DRAFT_RECEIPT_COLLECTION: "receipts", BudgetContextError: class extends Error {},
    requireSessionUserId: async () => 2, withPlanLock: async (_, task) => task(),
    getPlanBaseline: async () => ({ status: "For Clearance", driverId: 3 }),
    resolveDriverDepartment: async () => ({ departmentId: 8 }),
    getPlanSubmission: async () => ({ planId: 1, submission: { id: 3, status: "draft", submittedBy: 2, departmentId: 8, disbursementId: null, lines: [{ id: 10, lineNo: 1, amount: 700, receipts: [] }] } }),
    directusWrite: async () => { writes++; throw busy(); },
    directusFetch: async () => ({ data: [] }),
  };
  const api = load(`${directory}/[dispatchPlanId]/payables/route.ts`, {
    "../../_payables": dependencies, "../../_errors": errors, "next/server": responseMock,
  });
  const response = await api.POST({ json: async () => ({ action: "save-draft", submissionId: 3, departmentId: 8, lines: [{ id: 10, amount: 800 }] }) }, { params: Promise.resolve({ dispatchPlanId: "1" }) });
  assert.equal((await response.json()).outcome, "unknown");
  assert.ok(writes >= 2, "the existing compensation path was attempted but failed");
});

test("status reconciliation enforces ownership and flags incomplete saved records", async () => {
  let owner = 2;
  let total = 700;
  const api = load(`${directory}/[dispatchPlanId]/payables/route.ts`, {
    "../../_payables": {
      DRAFT_COLLECTION: "drafts", requireSessionUserId: async () => 2,
      withPlanLock: async (_, task) => task(),
      getPlanSubmission: async () => ({ planId: 1, submission: { id: 3, submittedBy: owner, totalAmount: total, lines: [{ amount: 700 }] } }),
    }, "../../_errors": errors, "next/server": responseMock,
  });
  const check = () => api.GET({ nextUrl: new URL("http://test.invalid/payables?submissionId=3") }, { params: Promise.resolve({ dispatchPlanId: "1" }) });
  assert.equal((await check()).status, 200);
  owner = 9;
  assert.equal((await check()).status, 403);
  owner = 2; total = 1000;
  assert.equal((await check()).status, 409);
});


test("a degraded refresh is rejected rather than replacing existing financial values with empty defaults", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: 1, werPayables: { budgetContextAvailable: false, budgetContextError: "Service temporarily busy" } });
  try {
    const api = load("src/modules/financial-management/reports/logistics-wer/services/logisticsWerApi.ts");
    await assert.rejects(api.fetchLogisticsWerDetails(1), /Service temporarily busy/);
  } finally { globalThis.fetch = original; }
});
