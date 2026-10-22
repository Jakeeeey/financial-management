import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import type { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import type { SupplierMemo } from "@/modules/financial-management/accounting/supplier-memos/types";
import { memoSlipLayout } from "./slip-pdf";

const originalFetch = globalThis.fetch;
let routes: typeof import("./handlers");
let templates: PdfTemplate[];
let requested: string[];
let admin: boolean;
type Row = Record<string, unknown>;
const memo: SupplierMemo = { id: 1, type: 1, memo_number: "SCM-001", supplier_id: 10, chart_of_account: 20,
  date: "2026-10-20", amount: "100.00", reason: "Memo reason", status: "Available", created_at: "2026-10-20T01:00:00Z",
  updated_at: "2026-10-20T01:00:00Z", encoder_id: 24 };

function template(id: number, paperSize: "Letter" | "Legal" | "Custom", landscape = false): PdfTemplate {
  return { id, name: paperSize === "Custom" ? "Thermal printer" : paperSize, config: {
    paperSize, customSize: { width: 58, height: 297 }, orientation: landscape ? "landscape" : "portrait",
    margins: { top: 2, right: 2, bottom: 2, left: 2 }, bodyStart: 10, bodyEnd: landscape ? 200 : 255,
    showGrid: false, snapToGrid: false, elements: {
      company_name: { id: "company_name", type: "text", label: "Company", visible: true,
        x: 5, y: 20, width: 48, height: 10, align: "left", style: { fontSize: 9, fontFamily: "helvetica", fontWeight: "normal", color: "#000000" } },
    },
  } };
}

function request(path = "", signedIn = true) {
  return new NextRequest("http://localhost/api/fm/accounting/supplier-credit-memo" + path,
    { headers: signedIn ? { Cookie: "vos_access_token=test-only" } : {} });
}
const context = (id = "1") => ({ params: Promise.resolve({ id }) });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

before(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://memo-print.test";
  process.env.DIRECTUS_STATIC_TOKEN = "test-only";
  process.env.SPRING_API_BASE_URL = "http://auth-print.test";
  routes = await import("./handlers");
});
beforeEach(() => {
  templates = [template(1, "Letter"), template(2, "Legal", true), template(6, "Custom")];
  requested = []; admin = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.ok(!init?.method || init.method === "GET", "Printing must never write to the backend.");
    requested.push(url.pathname);
    if (url.pathname === "/auth/me") return json({ id: 24, firstName: "Memo", lastName: "Tester", admin, isDeleted: false });
    if (url.pathname === "/revisions") return json({ data: [] });
    const [, collection, id] = url.pathname.match(/^\/items\/([^/]+)(?:\/(\d+))?$/) || [];
    const tables: Record<string, Row[]> = {
      pdf_templates: templates as unknown as Row[], suppliers_memo: [memo as unknown as Row],
      suppliers: [{ id: 10, supplier_name: "Test supplier" }], chart_of_accounts: [{ coa_id: 20, gl_code: "4002", account_title: "Test account" }],
      user: [{ user_id: 24, user_fname: "Memo", user_lname: "Tester" }], disbursement: [], disbursement_payables: [], audit_trail_table: [],
      user_access_modules: [{ id: 1, user_id: 24, module_id: { base_path: "/fm/accounting/supplier-credit-memo" } }],
      company: [{ company_id: 1, company_name: "Test Company", company_address: "Test address" }],
    };
    assert.ok(collection && tables[collection], "Unexpected print request " + url.pathname);
    if (id) return json({ data: tables[collection].find(row => Number(row.id) === Number(id)) });
    const filter = JSON.parse(url.searchParams.get("filter") || "{}");
    const rows = tables[collection].filter(row => Object.entries(filter).every(([field, condition]) => {
      const operations = condition as Row;
      if ("_eq" in operations) return String(row[field]) === String(operations._eq);
      if ("_in" in operations) return (operations._in as unknown[]).map(String).includes(String(row[field]));
      if ("_null" in operations) return row[field] == null;
      return true;
    }));
    return json({ data: rows });
  };
});
after(() => { globalThis.fetch = originalFetch; });

test("Standard Header defaults to full-page A4 portrait", () => {
  const layout = memoSlipLayout();
  assert.equal(layout.width, 210); assert.equal(layout.height, 297);
  assert.equal(layout.narrow, false); assert.equal(layout.orientation, "portrait");
});
test("thermal layout uses the saved custom dimensions and moves the body below visible header elements without changing the preset", () => {
  const thermal = template(6, "Custom");
  thermal.config.elements.company_name.y = 75;
  thermal.config.elements.company_name.width = 190;
  const before = structuredClone(thermal);
  const layout = memoSlipLayout(thermal);
  assert.equal(layout.width, 58); assert.equal(layout.height, 297); assert.equal(layout.narrow, true);
  assert.ok(layout.headerEnd >= 88); assert.deepEqual(thermal, before);
});
test("saved Letter and Legal landscape formats keep their actual paper dimensions", () => {
  assert.equal(memoSlipLayout(template(1, "Letter")).width, 215.9);
  const legal = memoSlipLayout(template(2, "Legal", true));
  assert.equal(legal.width, 355.6); assert.equal(legal.height, 215.9);
});
test("invalid paper geometry and templates without room for the body fail clearly", () => {
  const invalid = template(6, "Custom"); invalid.config.customSize.width = 0;
  assert.throws(() => memoSlipLayout(invalid), /invalid paper size/);
  invalid.config.customSize.width = 58; invalid.config.bodyEnd = 20;
  assert.throws(() => memoSlipLayout(invalid), /insufficient space/);
});
test("print options require authentication before reading any templates", async () => {
  const response = await routes.memoRoutes(1).list(request("?action=print-options", false));
  assert.equal(response.status, 401); assert.deepEqual(requested, []);
});
test("a credit-module assignee can read templates without Customer Memo access, but cannot use the debit module", async () => {
  admin = false;
  const allowed = await routes.memoRoutes(1).list(request("?action=print-options"));
  assert.equal(allowed.status, 200); assert.equal((await allowed.json()).templates.length, 3);
  const denied = await routes.memoRoutes(2).list(request("?action=print-options"));
  assert.equal(denied.status, 403);
});
test("print options include thermal templates without loading the memo list or exposing service credentials", async () => {
  const response = await routes.memoRoutes(1).list(request("?action=print-options"));
  const body = await response.text();
  assert.ok(body.includes("Thermal printer")); assert.ok(!body.includes("test-only"));
  assert.deepEqual(requested, ["/auth/me", "/items/pdf_templates"]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("the existing print URL returns an authorized Standard Header PDF without fetching saved templates", async () => {
  const response = await routes.memoRoutes(1).print(request("/1/print"), context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'inline; filename="SCM-001.pdf"');
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  assert.ok(!requested.includes("/items/pdf_templates"));
});
test("the template ID selects a server-side thermal preset and produces a PDF", async () => {
  const response = await routes.memoRoutes(1).print(request("/1/print?templateId=6"), context());
  assert.equal(response.status, 200);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  assert.ok(requested.includes("/items/pdf_templates"));
});
test("removed and invalid templates return explicit errors instead of silently using a different header", async () => {
  const missing = await routes.memoRoutes(1).print(request("/1/print?templateId=999"), context());
  assert.equal(missing.status, 404); assert.match((await missing.json()).message, /no longer available/);
  const invalid = await routes.memoRoutes(1).print(request("/1/print?templateId=0"), context());
  assert.equal(invalid.status, 400);
});
test("individual printing retains memo-type checks and rejects cross-module record IDs", async () => {
  const response = await routes.memoRoutes(2).print(request("/1/print"), context());
  assert.equal(response.status, 404);
});
