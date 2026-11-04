import { NextRequest } from "next/server";
import { readPettyCash } from "../../_spring";
import { fileError, readVoucherFile, removeVoucherFile, uploadVoucherFile } from "../_files";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
const id = (value: string) => /^[1-9]\d{0,17}$/.test(value);
async function forward(request: NextRequest, { params }: Context) {
  const { resource: parts } = await params, method = request.method;
  const voucher = parts[0] === "vouchers" && id(parts[1] || "");
  if (voucher && parts[2] === "attachments") {
    try {
      if (parts.length === 3 && method === "POST") return await uploadVoucherFile(parts[1], await request.formData());
      if (parts.length === 4 && id(parts[3]) && method === "GET") return await readVoucherFile(parts[1], parts[3], request.nextUrl.searchParams.get("view") === "preview");
      if (parts.length === 5 && id(parts[3]) && parts[4] === "remove" && method === "POST") return await removeVoucherFile(parts[1], parts[3], await request.json());
    } catch { return fileError("Send a valid file or attachment command.", 400); }
    return fileError("This attachment action is unavailable.", 404);
  }
  const validGet = method === "GET" && (parts.length === 1 && ["funds", "vouchers"].includes(parts[0]) || parts.length === 2 && (voucher || parts[0] === "lookups" && ["payees", "accounts", "tax-rules"].includes(parts[1])));
  const validWrite = method === "POST" && parts.length === 2 && parts[0] === "vouchers" && ["preview", "drafts"].includes(parts[1])
    || voucher && parts.length === 3 && (method === "PUT" && parts[2] === "draft" || method === "POST" && parts[2] === "discard");
  if (!validGet && !validWrite) return fileError("Unknown voucher resource or action.", 404);
  let body: string | undefined;
  if (method !== "GET") { try { body = JSON.stringify(await request.json()); } catch { return fileError("Send a valid JSON document.", 400); } }
  const query = request.nextUrl.searchParams.toString();
  return readPettyCash(`disbursement/${parts.join("/")}${query ? `?${query}` : ""}`, { method, body, signal: request.signal });
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
