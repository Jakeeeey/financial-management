import { NextRequest } from "next/server";
import { readPettyCash } from "../../_spring";
import { fileError, readVoucherFile, removeVoucherFile, uploadVoucherFile } from "../../disbursement/_files";
import { replenishmentPdf } from "../_print";
import type { ReplenishmentPreview, ReplenishmentRequest } from "@/modules/financial-management/petty-cash/replenishment-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
const id = (value: string) => /^[1-9]\d{0,17}$/.test(value);
async function forward(request: NextRequest, { params }: Context) {
  const { resource: p } = await params, method = request.method;
  const fund = p[0] === "funds" && id(p[1] || ""), record = p[0] === "requests" && id(p[1] || "");
  if (record && p[2] === "attachments") {
    try {
      if (p.length === 3 && method === "POST") return await uploadVoucherFile(p[1], await request.formData(), "replenishment/requests");
      if (p.length === 4 && id(p[3]) && method === "GET") return await readVoucherFile(p[1], p[3], request.nextUrl.searchParams.get("view") === "preview", "replenishment/requests");
      if (p.length === 5 && id(p[3]) && p[4] === "remove" && method === "POST") return await removeVoucherFile(p[1], p[3], await request.json(), "replenishment/requests");
    } catch { return fileError("Send a valid file or attachment command.", 400); }
    return fileError("This attachment action is unavailable.", 404);
  }
  const query = request.nextUrl.searchParams.toString();
  if (method === "GET" && p.length === 3 && p[2] === "print" && (fund || record)) {
    const upstream = await readPettyCash(record ? `replenishment/requests/${p[1]}` : `replenishment/funds/${p[1]}/preview${query ? `?${query}` : ""}`);
    if (!upstream.ok) return upstream;
    const data = await upstream.json() as ReplenishmentRequest | ReplenishmentPreview;
    let document = record ? data as ReplenishmentRequest : null;
    if (record && !document?.snapshot) return fileError("Print the working draft from the fund reconciliation page.", 400);
    if (fund) {
      const draft = await readPettyCash(`replenishment/funds/${p[1]}/draft`);
      if (!draft.ok) return draft;
      document = (await draft.json()).record;
      for (const cookie of draft.headers.getSetCookie()) upstream.headers.append("Set-Cookie", cookie);
    }
    const bytes = replenishmentPdf(record ? (data as ReplenishmentRequest).snapshot! : data as ReplenishmentPreview, document);
    const response = new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${record ? (data as ReplenishmentRequest).docNo || "Draft" : "Draft"}-replenishment.pdf"`, "Cache-Control": "no-store" } });
    for (const cookie of upstream.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  }
  const validGet = method === "GET" && (p.length === 1 && ["funds", "approvers", "requests"].includes(p[0]) || record && p.length === 2 || fund && (p.length === 3 && ["draft", "preview", "accruals"].includes(p[2]) || p.length === 4 && p[2] === "accruals" && p[3] === "preview"));
  const validWrite = fund && p.length === 3 && (method === "PUT" && p[2] === "draft" || method === "POST" && p[2] === "accruals") || record && p.length === 3 && method === "POST" && p[2] === "submit";
  if (!validGet && !validWrite) return fileError("Unknown replenishment resource or action.", 404);
  let body: string | undefined;
  if (method !== "GET") { try { body = JSON.stringify(await request.json()); } catch { return fileError("Send a valid JSON document.", 400); } }
  return readPettyCash(`replenishment/${p.join("/")}${query ? `?${query}` : ""}`, { method, body, signal: request.signal });
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
