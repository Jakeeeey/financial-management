import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const supplier_name = searchParams.get("supplier_name") || "";
    const date_from = searchParams.get("date_from") || "";
    const date_to = searchParams.get("date_to") || "";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const offset = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = { _eq: status };
    if (supplier_name) filter.supplier_id = { supplier_name: { _eq: supplier_name } };
    if (date_from || date_to) {
      const leadDateFilter: Record<string, string> = {};
      if (date_from) leadDateFilter._gte = date_from;
      if (date_to) leadDateFilter._lte = date_to;
      filter.lead_date = leadDateFilter;
    }
    if (q) filter._or = [{ procurement_no: { _contains: q } }];

    const params = new URLSearchParams({
      limit: String(pageSize), offset: String(offset), sort: "-created_at",
      meta: "filter_count,total_count",
      fields: "*,supplier_id.supplier_name,encoder_id.*,department_id.*",
    });
    if (Object.keys(filter).length > 0) params.set("filter", JSON.stringify(filter));

    const res = await fetch(`${DIRECTUS_URL}/items/procurement?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const rows = (data.data || []).map((r: Record<string, unknown>) => {
      const sid = r.supplier_id as Record<string, unknown> | null | undefined;
      const eid = r.encoder_id as Record<string, unknown> | null | undefined;
      const did = r.department_id as Record<string, unknown> | null | undefined;
      return {
        id: r.id as number, procurement_no: r.procurement_no as string,
        supplier_id: (sid?.id as number) ?? (r.supplier_id as number),
        lead_date: r.lead_date as string, total_amount: r.total_amount as number,
        created_at: r.created_at as string, updated_at: r.updated_at as string,
        encoder_id: (eid?.id as number) ?? (r.encoder_id as number),
        department_id: (did?.id as number) ?? (r.department_id as number),
        po_no: r.po_no as number, isApproved: r.isApproved as number,
        approved_by: r.approved_by as number, approved_date: r.approved_date as string,
        transaction_type: r.transaction_type as string, status: r.status as string,
        supplier_name: (sid?.supplier_name as string) ?? null,
        encoder_name: eid ? `${(eid.first_name as string) ?? ""} ${(eid.last_name as string) ?? ""}`.trim() || null : null,
        department_name: (did?.name as string) ?? null,
      };
    });

    return NextResponse.json({ data: rows, meta: data.meta || {} });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
