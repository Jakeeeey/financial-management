import { NextResponse } from "next/server";
import { MemoExportError } from "../_read";

export const EXCEL_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function excelResponse(bytes: ArrayBuffer, filename: string) {
  const safeName = filename.replace(/\.xlsx$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 155) + ".xlsx";
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": EXCEL_TYPE, "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function exportFailure(error: unknown, signal: AbortSignal) {
  const status = signal.aborted ? 499 : error instanceof MemoExportError ? error.status : 503;
  const message = signal.aborted ? "Export canceled." : error instanceof MemoExportError ? error.message
    : error instanceof Error && /^A memo field exceeds Excel|^The export exceeds Excel/.test(error.message) ? error.message : "Unable to generate the memo export. Please retry.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
