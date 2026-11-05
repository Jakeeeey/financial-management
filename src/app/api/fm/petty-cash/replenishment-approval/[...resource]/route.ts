import { NextRequest } from "next/server";
import { readPettyCash } from "../../_spring";
import { fileError, readVoucherFile } from "../../disbursement/_files";
import { replenishmentPdf } from "../../replenishment/_print";
import type { ReplenishmentReview } from "@/modules/financial-management/petty-cash/replenishment-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
const id = (value: string) => /^[1-9]\d{0,17}$/.test(value);
async function forward(request: NextRequest, { params }: Context) {
  const { resource: p } = await params, method = request.method;
  const record = p[0] === "requests" && id(p[1] || "");
  if (record && method === "GET" && p.length === 4 && p[2] === "attachments" && id(p[3])) return readVoucherFile(p[1], p[3], request.nextUrl.searchParams.get("view") === "preview", "replenishment-approval/requests");
  if (record && method === "GET" && p.length === 3 && p[2] === "print") {
    const upstream = await readPettyCash(`replenishment-approval/requests/${p[1]}`);
    if (!upstream.ok) return upstream;
    const data = await upstream.json() as ReplenishmentReview, doc = data.row.request;
    if (!doc.snapshot) return fileError("The submitted request snapshot is unavailable.", 409);
    const bytes = replenishmentPdf(doc.snapshot, doc);
    const response = new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.docNo}-replenishment.pdf"`, "Cache-Control": "no-store" } });
    for (const cookie of upstream.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  }
  const validGet = method === "GET" && (p.length === 1 && p[0] === "requests" || record && p.length === 2);
  const validWrite = method === "POST" && record && p.length === 3 && ["approve", "reject"].includes(p[2]);
  if (!validGet && !validWrite) return fileError("Unknown replenishment approval resource or action.", 404);
  let body: string | undefined;
  if (method !== "GET") { try { body = JSON.stringify(await request.json()); } catch { return fileError("Send a valid JSON decision.", 400); } }
  return readPettyCash(`replenishment-approval/${p.join("/")}${request.nextUrl.search ? request.nextUrl.search : ""}`, { method, body, signal: request.signal });
}
export const GET = forward;
export const POST = forward;
