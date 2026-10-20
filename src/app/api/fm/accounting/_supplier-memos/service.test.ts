import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { SupplierMemo } from "@/modules/financial-management/accounting/supplier-memos/types";
import { memoMatchesFilters, memoStats } from "@/modules/financial-management/accounting/supplier-memos/types";

type Row = Record<string, unknown>;
const originalFetch = globalThis.fetch;
let service: typeof import("./service");
let access: typeof import("./access");
let caps: typeof import("../../treasury/disbursements/_memo-cap-integrity");
let tables: Record<string, Row[]>;
let patchCount: number;
let auditFailure: string;
let patchFailure: "none" | "unknown" | "after-save" | "rejected";
let admin: boolean;
let authStatus: number;
const actor = { id: 24, name: "Memo Tester" };
const baseMemo = (): SupplierMemo => ({ id: 1, memo_number: "SCM-001", type: 1, supplier_id: 10, chart_of_account: 20,
  date: "2026-10-20", amount: "100.00", reason: "Original", status: "Available", encoder_id: 24,
  created_at: "2026-10-20T01:00:00Z", updated_at: "2026-10-20T01:00:00Z", deleted_at: null });

before(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://memo.test";
  process.env.DIRECTUS_STATIC_TOKEN = "test-only";
  process.env.SPRING_API_BASE_URL = "http://auth.test";
  service = await import("./service");
  access = await import("./access");
  caps = await import("../../treasury/disbursements/_memo-cap-integrity");
});
beforeEach(() => {
  patchCount = 0; auditFailure = ""; patchFailure = "none"; admin = true; authStatus = 200;
  tables = { suppliers_memo: [baseMemo() as unknown as Row], suppliers: [{ id: 10, supplier_name: "Test supplier", supplier_type: "TRADE", isActive: 1 }],
    chart_of_accounts: [{ coa_id: 20, gl_code: "4002", account_title: "Test account" }],
    user: [{ user_id: 24, user_fname: "Memo", user_lname: "Tester" }], disbursement_payables: [], disbursement: [],
    audit_trail_table: [], user_access_modules: [],
    revisions: [{ id: 1, collection: "suppliers_memo", item: "1", data: baseMemo(), delta: baseMemo(),
      activity: { id: 1, timestamp: "2026-10-20T01:00:00Z", user_agent: "Legacy" } }] };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/auth/me") return json({ id: 24, firstName: "Memo", lastName: "Tester", admin, isDeleted: false }, authStatus);
    const [, collection, id] = url.pathname.match(/^\/items\/([^/]+)(?:\/(\d+))?$/) || [];
    const name = collection || (url.pathname === "/revisions" ? "revisions" : "");
    assert.ok(name && tables[name], "Unexpected test request " + url.pathname);
    const payload = init?.body ? JSON.parse(String(init.body)) : {};
    if (init?.method === "POST" && name === "audit_trail_table") {
      if (auditFailure && payload.action.endsWith(auditFailure)) return json({ errors: [{ message: "Audit unavailable" }] }, 500);
      const row = { ...payload, id: tables[name].length + 1 };
      tables[name].push(row); return json({ data: row });
    }
    if (init?.method === "PATCH") {
      patchCount++;
      if (patchFailure === "unknown") throw new TypeError("Timed out");
      if (patchFailure === "rejected") return json({ errors: [{ message: "Validation rejected" }] }, 422);
      const row = tables[name].find(row => Number(row.id) === Number(id))!;
      Object.assign(row, payload);
      const revisionId = tables.revisions.length + 1;
      tables.revisions.push({ id: revisionId, collection: "suppliers_memo", item: id, data: structuredClone(row), delta: payload,
        activity: { id: revisionId, timestamp: new Date().toISOString(), user_agent: new Headers(init.headers).get("User-Agent") } });
      if (patchFailure === "after-save") throw new TypeError("Response lost");
      return json({ data: row });
    }
    const filter = JSON.parse(url.searchParams.get("filter") || "{}");
    for (const [key, value] of url.searchParams) {
      const match = key.match(/^filter\[([^\]]+)\]\[([^\]]+)\]$/);
      if (match) filter[match[1]] = { [match[2]]: match[2] === "_in" ? value.split(",") : value };
    }
    const rows = tables[name].filter(row => Object.entries(filter).every(([field, rules]) =>
      Object.entries(rules as Row).every(([operator, expected]) => {
        const actual = row[field];
        if (operator === "_eq") return String(actual) === String(expected);
        if (operator === "_neq") return String(actual) !== String(expected);
        if (operator === "_null") return actual == null;
        if (operator === "_contains") return String(actual).includes(String(expected));
        if (operator === "_in") return (expected as unknown[]).map(String).includes(String(actual));
        throw new Error("Unsupported test filter " + operator);
      })));
    return json({ data: rows });
  };
});
after(() => { globalThis.fetch = originalFetch; });

const change = (revision: string, overrides: Row = {}) => ({ requestId: randomUUID(), expectedRevision: revision, changeReason: "Correct the reason",
  values: { supplier_id: 10, chart_of_account: 20, date: "2026-10-20", amount: "125.50", reason: "Corrected" }, ...overrides });
function link({ supplier = 10, status = "Draft", amount = 25 } = {}) {
  tables.disbursement.push({ id: 50, doc_no: "TR-050", status, payee: supplier, is_employee: false });
  tables.disbursement_payables.push({ id: 60, reference_no: "SCM-001", amount, disbursement_id: 50 });
}

test("edits an unused memo, preserves identity and records actor, reason and before/after values", async () => {
  const detail = await service.getDetail(1, 1);
  const input = change(detail.revisionToken);
  Object.assign(input.values, { memo_number: "REPLACED", type: 2, encoder_id: 99, created_at: "2020-01-01T00:00:00Z" });
  const result = await service.mutateMemo(1, 1, actor, "EDIT", input);
  assert.equal(result.state, "saved"); assert.equal(result.data?.amount, "125.50");
  assert.equal(result.data?.memo_number, "SCM-001"); assert.equal(result.data?.encoder_id, 24);
  assert.equal(result.data?.created_at, baseMemo().created_at);
  const [event] = await service.getHistory(1, 1);
  assert.equal(event.outcome, "completed"); assert.equal(event.actorName, actor.name);
  assert.equal(event.reason, "Correct the reason"); assert.equal(event.before.amount, "100.00");
  assert.equal(event.after.amount, "125.50");
});
test("repeating a saved request does not write again", async () => {
  const detail = await service.getDetail(1, 1), input = change(detail.revisionToken);
  await service.mutateMemo(1, 1, actor, "EDIT", input);
  assert.equal((await service.mutateMemo(1, 1, actor, "EDIT", input)).state, "saved");
  assert.equal(patchCount, 1);
});
test("rejects a stale revision before any audit or memo write", async () => {
  const detail = await service.getDetail(1, 1);
  tables.suppliers_memo[0].reason = "Another user changed this";
  await assert.rejects(service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken)), /changed since/);
  assert.equal(patchCount, 0); assert.equal(tables.audit_trail_table.length, 0);
});
test("serializes competing edits in one process, including legacy numeric references", async () => {
  tables.suppliers_memo[0].memo_number = "123";
  const detail = await service.getDetail(1, 1);
  const results = await Promise.allSettled([
    service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken)),
    service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken)),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(patchCount, 1);
});
for (const status of ["Draft", "Submitted", "Posted"]) test("blocks edits and cancellation with " + status + " usage, including a zero-value link", async () => {
  link({ status, amount: 0 });
  const detail = await service.getDetail(1, 1);
  assert.equal(detail.eligibility.canEdit, false);
  await assert.rejects(service.mutateMemo(1, 1, actor, "CANCEL", change(detail.revisionToken)), /reserved or applied/);
  assert.equal(patchCount, 0);
});
test("does not attribute another supplier's matching reference to this memo", async () => {
  link({ supplier: 11 });
  assert.equal((await service.getDetail(1, 1)).eligibility.canEdit, true);
});
test("does not present an untraceable historical Applied memo as an available balance", async () => {
  tables.suppliers_memo[0].status = "Applied";
  const detail = await service.getDetail(1, 1);
  assert.equal(detail.eligibility.canEdit, false);
  assert.equal(detail.eligibility.remainingAmount, null);
  assert.equal(detail.eligibility.appliedAmount, null);
});
test("fails closed for orphaned or ambiguous application references", async () => {
  link();
  tables.suppliers_memo.push({ ...baseMemo(), id: 2, type: 2 } as unknown as Row);
  const detail = await service.getDetail(1, 1);
  assert.equal(detail.eligibility.ambiguous, true); assert.equal(detail.eligibility.remainingAmount, null);
  tables.disbursement.length = 0;
  assert.equal((await service.getDetail(1, 1)).eligibility.canCancel, false);
});
test("requires a reason and enforces credit/debit route identity", async () => {
  await assert.rejects(service.getDetail(1, 2), /not found/);
  const detail = await service.getDetail(1, 1);
  await assert.rejects(service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken, { changeReason: " " })), /reason/);
  assert.equal(patchCount, 0);
});
test("does not mutate when the pre-change audit write fails", async () => {
  const detail = await service.getDetail(1, 1); auditFailure = "REQUESTED";
  await assert.rejects(service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken)), /audit entry/);
  assert.equal(patchCount, 0);
});
test("reports a saved memo distinctly when audit completion fails; native revision recovers history", async () => {
  const detail = await service.getDetail(1, 1); auditFailure = "COMPLETED";
  const result = await service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken));
  assert.equal(result.state, "saved-audit-pending"); assert.equal((await service.getHistory(1, 1))[0].outcome, "completed");
});
test("an unconfirmed write blocks fresh requests and is never silently retried", async () => {
  const detail = await service.getDetail(1, 1); patchFailure = "unknown";
  const input = change(detail.revisionToken);
  assert.equal((await service.mutateMemo(1, 1, actor, "EDIT", input)).state, "unknown");
  assert.equal((await service.getDetail(1, 1)).eligibility.canEdit, false);
  assert.equal((await service.mutateMemo(1, 1, actor, "EDIT", input)).state, "unknown");
  assert.equal(patchCount, 1);
});
test("a lost save response is reconciled through the correlated native revision", async () => {
  const detail = await service.getDetail(1, 1), input = change(detail.revisionToken);
  patchFailure = "after-save";
  assert.equal((await service.mutateMemo(1, 1, actor, "EDIT", input)).state, "unknown");
  assert.equal((await service.mutateMemo(1, 1, actor, "EDIT", input)).state, "saved");
  assert.equal(patchCount, 1);
});
test("cancel retains the face amount, removes remaining balance and cannot be applied for even one cent", async () => {
  const detail = await service.getDetail(1, 1);
  await service.mutateMemo(1, 1, actor, "CANCEL", change(detail.revisionToken));
  assert.equal(tables.suppliers_memo[0].amount, "100.00"); assert.equal(tables.suppliers_memo[0].status, "CANCELLED");
  assert.equal((await service.getDetail(1, 1)).eligibility.remainingAmount, 0);
  assert.match((await caps.validateSupplierMemoCaps(10, [{ referenceNo: "SCM-001", amount: 0.01 }]))!.message, /cancelled/);
  const stats = memoStats([tables.suppliers_memo[0] as unknown as SupplierMemo]);
  assert.equal(stats.totalAmount, 0); assert.equal(stats.cancelledAmount, 100);
});
test("cap checks use this supplier's memo and usage when other suppliers share the reference", async () => {
  tables.suppliers_memo.push({ ...baseMemo(), id: 2, supplier_id: 11, amount: "1.00" } as unknown as Row);
  link({ supplier: 11, status: "Posted", amount: 100 });
  assert.equal(await caps.validateSupplierMemoCaps(10, [{ referenceNo: "SCM-001", amount: 25 }]), null);
});
for (const value of [0, 0.01]) test("cancelled numeric memo references cannot bypass validation with amount " + value, async () => {
  tables.suppliers_memo[0].memo_number = "123";
  tables.suppliers_memo[0].status = "CANCELLED";
  assert.match((await caps.validateSupplierMemoCaps(10, [{ referenceNo: 123, amount: value }]))!.message, /cancelled/);
});
test("cap checks reject a supplier reference that identifies both a credit and debit memo", async () => {
  tables.suppliers_memo.push({ ...baseMemo(), id: 2, type: 2 } as unknown as Row);
  assert.match((await caps.validateSupplierMemoCaps(10, [{ referenceNo: "SCM-001", amount: 25 }]))!.message, /multiple matching/);
});
test("status refresh cannot restore a cancelled memo", async () => {
  tables.suppliers_memo[0].status = "CANCELLED";
  await caps.refreshSupplierMemoStatuses(10, ["SCM-001"]);
  assert.equal(patchCount, 0);
  assert.equal(tables.suppliers_memo[0].status, "CANCELLED");
});
test("a rejected write is recorded as failed, without blocking a later corrected request", async () => {
  const detail = await service.getDetail(1, 1);
  patchFailure = "rejected";
  await assert.rejects(service.mutateMemo(1, 1, actor, "EDIT", change(detail.revisionToken)), /Validation rejected/);
  assert.equal((await service.getHistory(1, 1))[0].outcome, "failed");
  assert.equal((await service.getDetail(1, 1)).eligibility.canEdit, true);
});
test("report and table filters match supplier, account, dates and search, including cancelled rows", () => {
  const memo = { ...baseMemo(), supplierName: "Example Trade", status: "CANCELLED" };
  assert.equal(memoMatchesFilters(memo, { search: "example", supplier_id: "10", chart_of_account: "20", status: "cancelled", date_from: "2026-10-20", date_to: "2026-10-20" }), true);
  assert.equal(memoMatchesFilters(memo, { search: "", supplier_id: "", chart_of_account: "", status: "", date_to: "2026-10-19" }), false);
});
test("module access permits a non-admin assignee, denies the other module and verifies the session", async () => {
  admin = false;
  tables.user_access_modules.push({ id: 1, user_id: 24, module_id: { base_path: "/fm/accounting/supplier-credit-memo" } });
  const request = new NextRequest("http://localhost/api/test", { headers: { Cookie: "vos_access_token=test-only" } });
  assert.equal((await access.requireMemoAccess(request, 1)).id, 24);
  await assert.rejects(access.requireMemoAccess(request, 2), /do not have access/);
  authStatus = 401;
  await assert.rejects(access.requireMemoAccess(request, 1), /expired/);
});
