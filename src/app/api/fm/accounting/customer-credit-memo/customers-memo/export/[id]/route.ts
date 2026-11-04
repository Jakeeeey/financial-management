import { NextRequest, NextResponse } from "next/server";
import { requireCustomerMemoModuleAccess } from "../../_edit";
import { MemoExportError, readMemoExportDetail, validMemoId } from "../../_read";
import { buildMemoRecordExcel } from "@/modules/financial-management/accounting/customers-memo/utils/memoExcel";
import { excelResponse, exportFailure } from "../_export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCustomerMemoModuleAccess(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: { "Cache-Control": "no-store" } });
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || !validMemoId(Number(id))) throw new MemoExportError("Choose a valid memo to export.", 400);
    const detail = await readMemoExportDetail(Number(id), request.signal);
    const bytes = await buildMemoRecordExcel(detail);
    request.signal.throwIfAborted();
    return excelResponse(bytes, `Customer_Memo_${detail.header.memo_number || id}.xlsx`);
  } catch (error) { return exportFailure(error, request.signal); }
}
