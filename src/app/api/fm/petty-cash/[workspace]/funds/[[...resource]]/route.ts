import { NextRequest, NextResponse } from "next/server";
import { readPettyCash } from "../../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ workspace: string; resource?: string[] }> };
async function forward(request: NextRequest, context: Context) {
  const { workspace, resource = [] } = await context.params;
  const id = resource.length > 0 && /^[1-9]\d{0,17}$/.test(resource[0]);
  const valid = ["onboarding-approval", "master-list"].includes(workspace) && (resource.length === 0 || id && (resource.length === 1 || workspace === "onboarding-approval" && resource.length === 2 && ["approve", "reject"].includes(resource[1])));
  if (!valid) return NextResponse.json({ code: "NOT_FOUND", message: "Unknown fund resource." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const action = resource.length === 2;
  if (request.method === "GET" ? action : request.method !== "POST" || !action) return NextResponse.json({ message: "This action is unavailable." }, { status: 405, headers: { "Cache-Control": "no-store" } });
  let body: string | undefined;
  if (request.method === "POST") {
    try { body = JSON.stringify(await request.json()); }
    catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Send a valid JSON document." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  }
  const query = request.nextUrl.searchParams.toString();
  return readPettyCash(`${workspace}/funds${resource.length ? `/${resource.join("/")}` : ""}${query ? `?${query}` : ""}`, { method: request.method, ...(body ? { body } : {}) });
}
export const GET = forward;
export const POST = forward;
