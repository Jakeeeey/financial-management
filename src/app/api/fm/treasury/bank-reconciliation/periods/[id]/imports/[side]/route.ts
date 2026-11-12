import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { proxySpring, refreshedAccessToken } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { parseTransactionWorkbook, WorkbookError } from "@/modules/financial-management/treasury/bank-reconciliation/services/transactionExcel";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROOT = "/api/v1/treasury/bank-reconciliation";
type Params = { params: Promise<{ id: string; side: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id, side } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id) || !/^[1-9]\d{0,17}$/.test(side)) return NextResponse.json({ message: "Unknown import report." }, { status: 404 });
  const response = await proxySpring(`${ROOT}/periods/${id}/imports/${side}`);
  response.headers.set("Cache-Control", "no-store"); return response;
}
export async function POST(request: Request, { params }: Params) {
  const { id, side } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id) || (side !== "BANK" && side !== "LEDGER")) return NextResponse.json({ message: "Unknown import side." }, { status: 404 });
  const session = await proxySpring(`${ROOT}/periods/${id}`);
  if (!session.ok) return session;
  let response: Response;
  try {
    const period = await session.json();
    if (period.status !== "OPEN") response = NextResponse.json({ message: "This reconciliation period is closed." }, { status: 409 });
    else {
      const data = await request.formData(), file = data.get("file"), version = Number(data.get("version")), requestId = String(data.get("requestId") || "");
      if (!(file instanceof File) || !data.has("version") || !Number.isSafeInteger(version) || version < 0 || !/^[a-f0-9-]{36}$/i.test(requestId)) throw new WorkbookError("Choose an .xlsx template and retry the import.");
      const buffer = new Uint8Array(await file.arrayBuffer()), rows = parseTransactionWorkbook(buffer, file.name, side);
      response = await proxySpring(`${ROOT}/periods/${id}/imports/${side}`, { method: "POST", body: JSON.stringify({ version, requestId, fileName: file.name, fileHash: createHash("sha256").update(buffer).digest("hex"), rows }) }, refreshedAccessToken(session));
    }
  } catch (e) { response = NextResponse.json({ message: e instanceof WorkbookError ? e.message : "Unable to read the upload. Nothing was imported; please retry." }, { status: 400 }); }
  response.headers.set("Cache-Control", "no-store");
  for (const cookie of session.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
  return response;
}
