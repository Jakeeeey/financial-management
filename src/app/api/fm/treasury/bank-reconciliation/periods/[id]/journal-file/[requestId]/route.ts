import { NextResponse, type NextRequest } from "next/server";
import { proxySpring, refreshedAccessToken } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { buildFallbackJournalExcel, fallbackFilename, FallbackJournalExportError } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/services/fallbackJournalExcel";
import type { FallbackExportData } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/posting-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROOT = "/api/v1/treasury/bank-reconciliation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const sources: Response[] = [];
  function finish(response: NextResponse) { response.headers.set("Cache-Control", "private, no-store"); response.headers.set("X-Content-Type-Options", "nosniff"); const cookies = new Map<string, string>(); for (const source of sources) for (const cookie of source.headers.getSetCookie()) cookies.set(cookie.split("=", 1)[0], cookie); for (const cookie of cookies.values()) response.headers.append("Set-Cookie", cookie); return response; }
  const fail = (message: string, status: number) => finish(NextResponse.json({ message }, { status }));
  async function upstream(response: Response) { const body = await response.json().catch(() => null); return fail(response.status < 500 ? body?.message || "Journal export failed." : "Unable to generate the journal file. Check its request status before retrying.", response.status); }
  try {
    const { id, requestId } = await params; if (!/^[1-9]\d{0,17}$/.test(id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)) return fail("Unknown journal export.", 404);
    request.signal.throwIfAborted(); const source = await proxySpring(`${ROOT}/periods/${id}/journal-export/${requestId}`, { signal: request.signal }, undefined, 60000); sources.push(source); if (!source.ok) return upstream(source);
    const data = await source.json() as FallbackExportData, filename = fallbackFilename(data), bytes = await buildFallbackJournalExcel(data); request.signal.throwIfAborted();
    const recorded = await proxySpring(`${ROOT}/periods/${id}/journal-export-recorded`, { method: "POST", body: JSON.stringify({ requestId, version: data.version, filename }), signal: request.signal }, refreshedAccessToken(source), 60000); sources.push(recorded); if (!recorded.ok) return upstream(recorded); if ((await recorded.json()).recorded !== true) throw new Error("Export was not confirmed.");
    return finish(new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"` } }));
  } catch (e) { return fail(request.signal.aborted ? "Journal file generation canceled. The request remains available in Posting." : e instanceof FallbackJournalExportError ? e.message : "Unable to generate the journal file. Check its request status before retrying.", request.signal.aborted ? 499 : e instanceof FallbackJournalExportError ? 400 : 503); }
}
