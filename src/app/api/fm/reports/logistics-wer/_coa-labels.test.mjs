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
  new Function("require", "exports", code)(name => {
    if (name in overrides) return overrides[name];
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name) + ".ts", overrides);
    return require(name);
  }, exports);
  return exports;
}
const directory = "src/app/api/fm/reports/logistics-wer";
const financialRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "coaCode" && key !== "coaTitle")));
const balances = [
  { coaId: 120, allocatedAmount: 500, reservedAmount: 600, remainingAmount: 0, overBudgetAmount: 100 },
  { coaId: 139, allocatedAmount: 0, reservedAmount: 300, remainingAmount: 0, overBudgetAmount: 300 },
  { coaId: 161, allocatedAmount: 420, reservedAmount: 0, remainingAmount: 420, overBudgetAmount: 0 },
];
const accounts = [{ coa_id: 120, gl_code: "1024", account_title: "Meal Allowance" }, { coa_id: "139", gl_code: "1035", account_title: "New Expense Account" }, { coa_id: 161, gl_code: "1031", account_title: "Fuel" }];
function fixture({ failLabels = false, rows = balances } = {}) {
  const requests = [];
  const route = load(`${directory}/[dispatchPlanId]/route.ts`, {
    "../_errors": { WerDependencyError: class extends Error {}, werFailureResponse: () => new Response(null, { status: 503 }) },
    "../_spring": { getSpringDispatchPlanDetail: async () => new Response(JSON.stringify({ id: 2, amount: 920, budgets: [{ coaId: 120 }, { coaId: 161 }] })) },
    "../_payables": {
      getPlanFinancialContext: async () => ({ plan: { driverId: 3 }, baseline: 920, reserved: 900, remaining: 420, allocatedBudget: 920, unclassifiedBudgetAmount: 0, unclassifiedReservedAmount: 0, overBudgetAmount: 400, budgetBalancesByCoa: rows, submissions: [] }),
      resolveDriverSupplier: async () => ({ eligible: true, supplierId: 4 }),
      directusFetch: async url => { requests.push(new URL(url, "http://test")); if (failLabels) throw new Error("Lookup unavailable"); return { data: accounts }; },
    },
  });
  return { requests, get: async () => route.GET({}, { params: Promise.resolve({ dispatchPlanId: "2" }) }) };
}

test("one batch lookup includes unallocated account IDs and retains every financial value", async () => {
  const before = structuredClone(balances);
  const f = fixture();
  const response = await f.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].pathname, "/items/chart_of_accounts");
  assert.equal(f.requests[0].searchParams.get("filter[coa_id][_in]"), "120,139,161");
  assert.equal(f.requests[0].searchParams.get("fields"), "coa_id,gl_code,account_title");
  assert.equal(f.requests[0].searchParams.has("filter[is_active][_eq]"), false);
  const rows = body.werPayables.budgetBalancesByCoa;
  assert.equal(rows[1].coaCode, "1035");assert.equal(rows[1].coaTitle, "New Expense Account");
  assert.deepEqual(financialRows(rows), before);
  assert.deepEqual(balances, before);
});

test("optional label failure preserves available financial context and balances", async t => {
  t.mock.method(console, "warn", () => {});
  const f = fixture({ failLabels: true });
  const body = await (await f.get()).json();
  assert.equal(body.werPayables.budgetContextAvailable, true);
  assert.equal(body.werPayables.reservedAmount, 900);
  assert.deepEqual(financialRows(body.werPayables.budgetBalancesByCoa), balances);
  assert.equal(body.werPayables.budgetBalancesByCoa[1].coaTitle, null);
  assert.equal(f.requests.length, 1);
});

test("empty balances do not fetch names, and duplicate IDs are queried once", async () => {
  const empty = fixture({ rows: [] });await empty.get();assert.equal(empty.requests.length, 0);
  const repeated = fixture({ rows: [balances[1], balances[1]] });await repeated.get();
  assert.equal(repeated.requests[0].searchParams.get("filter[coa_id][_in]"), "139");
});

test("metadata enrichment keeps names when lookups omit them, including historical rows", () => {
  const { addBudgetCoaLabels } = load(`${directory}/_coa-labels.ts`);
  const rows = [{ ...balances[1], coaCode: "OLD", coaTitle: "Historical account" }];
  const before = structuredClone(rows);
  assert.deepEqual(addBudgetCoaLabels(rows, []), before);
  const updated = addBudgetCoaLabels(rows, [{ coa_id: 139, gl_code: " 1035 ", account_title: " Current title " }]);
  assert.equal(updated[0].coaCode, "1035");assert.equal(updated[0].coaTitle, "Current title");
  assert.deepEqual(rows, before);
});
