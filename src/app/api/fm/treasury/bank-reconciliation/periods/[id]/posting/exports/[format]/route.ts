import { NextResponse, type NextRequest } from "next/server";
import { proxySpring, refreshedAccessToken } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { buildPostingExcel } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/services/postingExcel";
import { buildPostingPdf } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/services/postingPdf";
import { ReconcileExportError } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/services/reconcileExport";
import type { PostingExportData } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/posting-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; format: string }> };
const ROOT = "/api/v1/treasury/bank-reconciliation";
const TYPES = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" };

export async function POST(request: NextRequest, context: Context) {
  const sources: Response[] = [];
  function finish(response: NextResponse) {
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("X-Content-Type-Options", "nosniff");
    const cookies = new Map<string, string>();
    for (const source of sources) for (const cookie of source.headers.getSetCookie()) cookies.set(cookie.split("=", 1)[0] + (cookie.match(/;\s*path=([^;]*)/i)?.[1] || ""), cookie);
    for (const cookie of cookies.values()) response.headers.append("Set-Cookie", cookie);
    return response;
  }
  const fail = (message: string, status: number) => finish(NextResponse.json({ message }, { status }));
  async function upstream(response: Response) {
    const body = await response.json().catch(() => null);
    return fail(typeof body?.message === "string" && response.status < 500 ? body.message : "Unable to generate the Posting export. Please retry.", response.status >= 500 ? 503 : response.status);
  }
  try {
    const { id, format } = await context.params;
    if (!/^[1-9]\d{0,17}$/.test(id) || (format !== "xlsx" && format !== "pdf")) return fail("Unknown Posting export.", 404);
    const body = await request.json().catch(() => null) as { version?: unknown; bankVersion?: unknown; closureId?: unknown } | null;
    if (!Number.isSafeInteger(body?.version) || !Number.isSafeInteger(body?.bankVersion) || Number(body?.version) < 0 || Number(body?.bankVersion) < 0) return fail("Send the saved period and bank configuration versions.", 400);
    if (body?.closureId !== undefined && (!Number.isSafeInteger(body.closureId) || Number(body.closureId) < 1)) return fail("Choose a valid closure revision.", 400);
    request.signal.throwIfAborted();
    const query = new URLSearchParams({ version: String(body!.version), bankVersion: String(body!.bankVersion), format });
    if (body?.closureId !== undefined) query.set("closureId", String(body.closureId));
    const source = await proxySpring(`${ROOT}/periods/${id}/posting/export-data?${query}`, { signal: request.signal }, undefined, 60000); sources.push(source);
    if (!source.ok) return upstream(source);
    const data = await source.json() as PostingExportData;
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(data.filename) || !data.filename.endsWith(`.${format}`)) throw new Error("Invalid export filename.");
    const bytes = format === "xlsx" ? await buildPostingExcel(data) : await buildPostingPdf(data);
    request.signal.throwIfAborted();
    const audit = await proxySpring(`${ROOT}/periods/${id}/posting/exports`, { method: "POST", body: JSON.stringify({ version: data.period.version, bankVersion: data.period.bank.version, format, filename: data.filename, generatedAt: data.generatedAt, ...(data.period.lifecycle?.closureId ? { closureId: data.period.lifecycle.closureId } : {}) }), signal: request.signal }, refreshedAccessToken(source), 60000); sources.push(audit);
    if (!audit.ok) return upstream(audit);
    if ((await audit.json()).recorded !== true) throw new Error("Export audit was not confirmed.");
    request.signal.throwIfAborted();
    return finish(new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${data.filename}"` } }));
  } catch (error) {
    return fail(request.signal.aborted ? "Export canceled." : error instanceof ReconcileExportError ? error.message : "Unable to generate the Posting export. Please retry.", request.signal.aborted ? 499 : error instanceof ReconcileExportError ? 400 : 503);
  }
}
