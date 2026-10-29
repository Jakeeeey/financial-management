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
const directory = "src/app/api/fm/reports/logistics-wer-approval";
function fixture({ budgetFailure = false, auditFailure = false, withinBudget = false } = {}) {
  const writes = [];
  const submission = { id: 1, status: "submitted", departmentId: 8, totalAmount: 1600, disbursementId: null, lines: [{ id: 10, coaId: 1024, divisionId: 1, amount: 1000, receipts: [] }, { id: 11, coaId: 1031, divisionId: 1, amount: 600, receipts: [] }] };
  const dependencies = {
    DRAFT_COLLECTION: "drafts",
    withPlanLock: async (_, task) => task(),
    getPlanSubmission: async () => ({ planId: 2, submission }),
    getPlanBaseline: async () => ({ status: "For Clearance", docNo: "TEST", driverId: 3 }),
    resolveDriverSupplier: async () => ({ eligible: true, supplierId: 4 }),
    getPlanRemaining: async () => {
      if (budgetFailure) throw new Error("Budget unavailable");
      if (withinBudget) return { allocatedBudget: 2000, reserved: 1600, budgetBalancesByCoa: [{ coaId: 1024, allocatedAmount: 1200, reservedAmount: 1000 }, { coaId: 1031, allocatedAmount: 800, reservedAmount: 600 }] };
      return { baseline: 1050, allocatedBudget: 1050, reserved: 1600, budgetBalancesByCoa: [{ coaId: 1024, allocatedAmount: 900, reservedAmount: 1000 }, { coaId: 1031, allocatedAmount: 0, reservedAmount: 600 }] };
    },
    directusFetch: async () => ({ data: [{ amount: 1000 }, { amount: 600 }] }),
    directusWrite: async (method, url, body) => {
      writes.push({ method, url, body });
      if (auditFailure && method === "PATCH") throw new Error("Audit write failed");
      if (method === "PATCH" && url === "/items/drafts/1") Object.assign(submission, { status: body.status, disbursementId: body.disbursement_id, decisionRemarks: body.decision_remarks });
      return { data: { id: 9, transaction_type: 2, doc_no: "NT-1" } };
    },
  };
  const api = load(`${directory}/_decision.ts`, {
    "../logistics-wer/_payables": dependencies,
    "@/modules/financial-management/treasury/disbursement/document-number": { acquireDocumentNumberLock: async () => () => {}, findNextAvailableDocumentNumber: async () => "NT-1", documentPrefixForTransactionType: () => "NT" },
  });
  return { api, writes, submission };
}

test("approval blocks unacknowledged variance and blank reasons before conversion", async () => {
  for (const input of [{}, { acknowledgeVariance: true }, { remarks: "Reviewed" }]) {
    const { api, writes } = fixture();
    await assert.rejects(api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "", ...input }), error => error.status === 422);
    assert.equal(writes.length, 0);
  }
});

test("acknowledged overage converts all actual amounts and persists review evidence", async () => {
  const { api, writes, submission } = fixture();
  await api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "Emergency fuel receipt verified", acknowledgeVariance: true });
  assert.equal(submission.status, "approved");
  assert.match(submission.decisionRemarks, /Emergency fuel receipt verified/);
  assert.match(submission.decisionRemarks, /Budget variance acknowledged/);
  assert.match(submission.decisionRemarks, /net variance: PHP 550\.00/);
  assert.deepEqual(writes.filter(row => row.url === "/items/disbursement_payables").map(row => row.body.amount), [1000, 600]);
  const count = writes.length;
  await api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "" });
  assert.equal(writes.length, count, "retry must not create a duplicate");
});

test("unavailable budget context blocks approval without conversion", async () => {
  const { api, writes } = fixture({ budgetFailure: true });
  await assert.rejects(api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "Reviewed", acknowledgeVariance: true }), /Budget unavailable/);
  assert.equal(writes.length, 0);
});


test("new and existing drafts submit over-budget and unbudgeted actuals", async () => {
  for (const submissionId of [undefined, 1]) {
    const writes = [];
    const draft = { id: 1, status: "draft", departmentId: 8, submittedBy: 2, disbursementId: null, totalAmount: 0, lines: [] };
    const dependencies = {
      DRAFT_COLLECTION: "drafts", DRAFT_LINE_COLLECTION: "lines", DRAFT_RECEIPT_COLLECTION: "receipts",
      BudgetContextError: class extends Error {},
      withPlanLock: async (_, task) => task(),
      requireSessionUserId: async () => 2,
      getPlanBaseline: async () => ({ status: "For Clearance", driverId: 3 }),
      getPlanSubmission: async () => ({ planId: 2, submission: draft }),
      resolveDriverDepartment: async () => ({ departmentId: 8 }),
      resolveDriverSupplier: async () => ({ eligible: true, supplierId: 4 }),
      getPlanRemaining: async () => ({ allocatedBudget: 1050, reserved: 0, unclassifiedReservedAmount: 10, budgetBalancesByCoa: [{ coaId: 1024, allocatedAmount: 900, reservedAmount: 0 }] }),
      directusFetch: async () => ({ data: [] }),
      directusWrite: async (method, url, body) => { writes.push({ method, url, body }); return { data: { id: 1 } }; },
    };
    const api = load("src/app/api/fm/reports/logistics-wer/[dispatchPlanId]/payables/route.ts", {
      "../../_payables": dependencies,
      "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    });
    const response = await api.POST({ json: async () => ({ action: "submit", submissionId, departmentId: 8, lines: [{ coaId: 1024, divisionId: 1, amount: 1000 }, { coaId: 1031, divisionId: 1, amount: 600 }] }) }, { params: Promise.resolve({ dispatchPlanId: "2" }) });
    const payload = await response.json();
    assert.ok(response.ok, JSON.stringify(payload));
    assert.equal(payload.variance.netVariance, 550);
    assert.equal(payload.variance.requiresAcknowledgment, true);
    assert.ok(writes.some(row => row.body?.status === "submitted"));
  }
});


test("audit persistence failure cleans up converted disbursement before retry", async () => {
  const { api, writes } = fixture({ auditFailure: true });
  await assert.rejects(api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "Reviewed", acknowledgeVariance: true }), /Audit write failed/);
  assert.ok(writes.some(row => row.method === "DELETE" && row.url === "/items/disbursement/9"));
});


test("within-allocation approval needs no variance acknowledgment", async () => {
  const { api, submission } = fixture({ withinBudget: true });
  await api.decideOneSubmission({ submissionId: 1, decision: "approve", approverId: 2, remarks: "" });
  assert.equal(submission.status, "approved");
});
