import { NextRequest, NextResponse } from "next/server";
import { memoMatchesFilters, type SupplierMemoFilters, type SupplierMemoType } from "@/modules/financial-management/accounting/supplier-memos/types";
import { requireMemoAccess } from "./access";
import { MemoError, positiveId, readRows, type Row } from "./directus";
import { createMemo, getDetail, getHistory, listMemos, mutateMemo } from "./service";
import { memoReport, memoSlip } from "./pdf";

type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  const status = error instanceof MemoError ? error.status : error instanceof SyntaxError ? 400 : 503;
  return NextResponse.json({ ok: false, message: error instanceof MemoError ? error.message
    : status === 400 ? "Invalid request body." : "Supplier memo service is unavailable. Please try again." }, { status });
}

async function body(request: NextRequest): Promise<Row> {
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MemoError("Invalid request body.");
  return value;
}

function filters(request: NextRequest): SupplierMemoFilters {
  const query = request.nextUrl.searchParams;
  return { search: query.get("search") || "", supplier_id: query.get("supplier_id") || "",
    chart_of_account: query.get("chart_of_account") || "", status: query.get("status") || "",
    date_from: query.get("date_from") || "", date_to: query.get("date_to") || "" };
}

function pdfResponse(bytes: ArrayBuffer, filename: string) {
  return new NextResponse(bytes, { headers: { "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="' + filename.replace(/[^a-zA-Z0-9._-]/g, "_") + '"',
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export function memoRoutes(type: SupplierMemoType) {
  return {
    async list(request: NextRequest) {
      try {
        await requireMemoAccess(request, type);
        const action = request.nextUrl.searchParams.get("action");
        if (action === "suppliers") return NextResponse.json({ data: await readRows("suppliers",
          { isActive: { _eq: 1 }, supplier_type: { _eq: "TRADE" } }, "id,supplier_name,supplier_shortcut,supplier_type", "supplier_name,id") });
        if (action === "chart-of-accounts") return NextResponse.json({ data: await readRows("chart_of_accounts",
          { account_title: { _nnull: true } }, "coa_id,gl_code,account_title", "gl_code,coa_id") });
        const data = (await listMemos(type)).filter(memo => memoMatchesFilters(memo, filters(request)));
        return NextResponse.json({ data, total: data.length });
      } catch (error) { return failure(error); }
    },
    async create(request: NextRequest) {
      try {
        const actor = await requireMemoAccess(request, type);
        const data = await createMemo(type, actor, await body(request));
        return NextResponse.json({ ok: true, data, message: data.memo_number + " created successfully." }, { status: 201 });
      } catch (error) { return failure(error); }
    },
    async detail(request: NextRequest, context: Context) {
      try {
        await requireMemoAccess(request, type);
        return NextResponse.json(await getDetail(positiveId((await context.params).id), type));
      } catch (error) { return failure(error); }
    },
    async edit(request: NextRequest, context: Context) {
      try {
        const actor = await requireMemoAccess(request, type);
        return NextResponse.json(await mutateMemo(positiveId((await context.params).id), type, actor, "EDIT", await body(request)));
      } catch (error) { return failure(error); }
    },
    async cancel(request: NextRequest, context: Context) {
      try {
        const actor = await requireMemoAccess(request, type);
        return NextResponse.json(await mutateMemo(positiveId((await context.params).id), type, actor, "CANCEL", await body(request)));
      } catch (error) { return failure(error); }
    },
    async history(request: NextRequest, context: Context) {
      try {
        await requireMemoAccess(request, type);
        return NextResponse.json({ data: await getHistory(positiveId((await context.params).id), type) });
      } catch (error) { return failure(error); }
    },
    async print(request: NextRequest, context: Context) {
      try {
        const actor = await requireMemoAccess(request, type);
        const id = positiveId((await context.params).id);
        const [detail, history] = await Promise.all([getDetail(id, type), getHistory(id, type)]);
        return pdfResponse(await memoSlip(detail, history, actor), detail.memo.memo_number + ".pdf");
      } catch (error) { return failure(error); }
    },
    async report(request: NextRequest) {
      try {
        const actor = await requireMemoAccess(request, type);
        const selection = filters(request);
        const memos = (await listMemos(type)).filter(memo => memoMatchesFilters(memo, selection));
        return pdfResponse(await memoReport(memos, type, selection, actor), "supplier-" + (type === 1 ? "credit" : "debit") + "-memo-summary.pdf");
      } catch (error) { return failure(error); }
    },
  };
}
