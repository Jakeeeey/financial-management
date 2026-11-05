import { NextRequest, NextResponse } from "next/server";
import { requireCustomerMemoModuleAccess } from "../../_edit";
import { MemoExportError, readSummaryMemos, validMemoId } from "../../_read";
import { buildMemoSummaryExcel } from "@/modules/financial-management/accounting/customers-memo/utils/memoExcel";
import { excelResponse, exportFailure } from "../_export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const access = await requireCustomerMemoModuleAccess(request);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: { "Cache-Control": "no-store" } });
    const body = await request.json().catch(() => null) as { memoIds?: unknown; filters?: unknown } | null;
    if (!Array.isArray(body?.memoIds) || !body.memoIds.length || !body.memoIds.every(validMemoId)) throw new MemoExportError("Choose at least one valid memo to export.", 400);
    const ids = [...new Set<number>(body.memoIds)];
    if (ids.length > 1_048_565) throw new MemoExportError("The export exceeds Excel's worksheet row limit. Narrow the filters and retry.", 400);
    if (body.filters !== undefined && (!Array.isArray(body.filters) || !body.filters.every(item => typeof item === "string"))) throw new MemoExportError("The export filter description is invalid.", 400);
    const filters = (body.filters || []) as string[];
    const rows = await readSummaryMemos(ids, request.signal);
    const bytes = await buildMemoSummaryExcel(rows, filters);
    request.signal.throwIfAborted();
    return excelResponse(bytes, `Customer_Memos_Summary_${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date())}.xlsx`);
  } catch (error) { return exportFailure(error, request.signal); }
}
