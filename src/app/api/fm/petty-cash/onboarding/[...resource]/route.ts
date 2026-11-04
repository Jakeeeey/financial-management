import { NextRequest, NextResponse } from "next/server";
import { readPettyCash } from "../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
const lists = new Set(["settings", "master-links", "funds", "payees", "tax-rules", "readiness"]);
const lookup = new Set(["accounts", "suppliers", "personnel", "departments", "branches", "companies"]);
async function forward(request: NextRequest, context: Context) {
  const { resource } = await context.params;
  const valid = resource.length === 1 && lists.has(resource[0])
    || resource.length === 2 && (resource[0] === "lookups" && lookup.has(resource[1])
      || ["funds", "payees", "tax-rules"].includes(resource[0]) && /^[1-9]\d{0,17}$/.test(resource[1])
      || resource[0] === "funds" && resource[1] === "submit");
  if (!valid) return NextResponse.json({ code: "NOT_FOUND", message: "Unknown Onboarding resource.", requestId: crypto.randomUUID() }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const method = request.method;
  const writable = method === "GET" || method === "PUT" && (resource[0] === "settings" && resource.length === 1 || ["payees", "tax-rules"].includes(resource[0]) && resource.length === 2)
    || method === "POST" && (resource.length === 1 && ["payees", "tax-rules"].includes(resource[0]) || resource.length === 2 && resource[0] === "funds" && resource[1] === "submit");
  if (method === "GET" && resource[0] === "funds" && resource[1] === "submit") return NextResponse.json({ message: "This action is unavailable." }, { status: 405, headers: { "Cache-Control": "no-store" } });
  if (!writable) return NextResponse.json({ message: "This action is unavailable." }, { status: 405, headers: { "Cache-Control": "no-store" } });
  let body: string | undefined;
  if (method !== "GET") {
    try { body = JSON.stringify(await request.json()); }
    catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Send a valid JSON document.", requestId: crypto.randomUUID() }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  }
  const query = request.nextUrl.searchParams.toString();
  return readPettyCash(`onboarding/${resource.join("/")}${query ? `?${query}` : ""}`, { method, ...(body ? { body } : {}) });
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
