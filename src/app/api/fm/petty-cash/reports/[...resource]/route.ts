import { NextRequest, NextResponse } from "next/server";
import { readPettyCash } from "../../_spring";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { reportPdf, certificatePdf } from "../_print";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
const reports = "(?:vouchers|funds|reps|ewt|journal|tb|counts|audit|gl-lines|voucher-lines|fund-master)", id = "[1-9]\\d{0,17}";
export async function GET(request: NextRequest, context: Context) {
  const path = (await context.params).resource.join("/"), query = request.nextUrl.searchParams.toString(), tail = query ? `?${query}` : "";
  const allowed = /^(metadata|overview|current-position|audit\/verify|lookups\/(funds|accounts|payees))$/.test(path) || new RegExp(`^(tables|print|print-data|export)/${reports}$`).test(path) || new RegExp(`^audit/${id}$`).test(path) || new RegExp(`^certificates/${id}(?:/print)?$`).test(path);
  if (!allowed) return missing();
  if (path.startsWith("export/")) {
    const source = await proxySpring(`/api/petty-cash/reports/${path}${tail}`, { headers: { Accept: "text/csv, application/json" }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]) });
    if (!source.ok) { const body = await source.json().catch(() => null); const failure = NextResponse.json({ code: "EXPORT_FAILED", message: typeof body?.message === "string" && body.message.length <= 500 ? body.message : "Unable to export this report.", requestId: typeof body?.requestId === "string" && /^[\w-]{1,80}$/.test(body.requestId) ? body.requestId : source.headers.get("X-Request-Id") }, { status: source.status >= 500 ? 503 : source.status, headers: { "Cache-Control": "no-store" } }); for (const cookie of source.headers.getSetCookie()) failure.headers.append("Set-Cookie", cookie); return failure; }
    const headers = new Headers(source.headers); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); return new NextResponse(source.body, { status: source.status, headers });
  }
  const print = path.startsWith("print/") || path.endsWith("/print"), sourcePath = path.startsWith("print/") ? path.replace(/^print\//, "print-data/") : path.replace(/\/print$/, "");
  const source = await readPettyCash(`reports/${sourcePath}${tail}`, { signal: request.signal });
  if (!print || !source.ok) return source;
  try {
    const data = await source.json(), bytes = path.startsWith("print/") ? reportPdf(data) : certificatePdf(data), headers = new Headers(source.headers);
    headers.set("Content-Type", "application/pdf"); headers.set("Content-Disposition", `inline; filename="petty-cash-${path.replace(/\//g, "-")}.pdf"`); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.delete("Content-Length"); return new NextResponse(Buffer.from(bytes), { headers });
  } catch { return NextResponse.json({ code: "FOUNDATION_UNAVAILABLE", message: "Unable to generate the report PDF. Retry the document link." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
function missing() { return NextResponse.json({ code: "NOT_FOUND", message: "Unknown Petty Cash report resource." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: NextRequest, context: Context) {
  if ((await context.params).resource.join("/") !== "certificates") return missing();
  try { const body = JSON.stringify(await request.json()); return readPettyCash("reports/certificates", { method: "POST", body, signal: request.signal }); }
  catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Send a valid certificate request." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
