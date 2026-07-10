import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const statusRaw = searchParams.get("status") || "";
    const status = statusRaw === "_all" ? "" : statusRaw;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    const linkedRes = await fetch(
      `${DIRECTUS_URL}/items/procurement?fields=po_no&filter=${encodeURIComponent(JSON.stringify({ po_no: { _nnull: true } }))}&limit=-1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!linkedRes.ok) throw new Error(await linkedRes.text());
    const linkedJson = await linkedRes.json();
    const poIds = (linkedJson.data || [])
      .map((r: { po_no: unknown }) => Number(r.po_no))
      .filter((id: number) => !Number.isNaN(id));
    if (poIds.length > 0) {
      andConditions.push({ purchase_order_id: { _in: poIds } });
    } else {
      andConditions.push({ purchase_order_id: { _eq: -1 } });
    }

    if (search) {
      andConditions.push({ purchase_order_no: { _icontains: search } });
    }
    if (status) {
      andConditions.push({ status: { _eq: status } });
    }

    if (andConditions.length === 1) {
      Object.assign(filter, andConditions[0]);
    } else if (andConditions.length > 1) {
      filter._and = andConditions;
    }

    const params = new URLSearchParams({
      fields: "*,supplier_id.supplier_name",
      sort: "-purchase_order_id",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
    });
    if (Object.keys(filter).length) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(`${DIRECTUS_URL}/items/purchase_order?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    return NextResponse.json({
      data: json.data || [],
      total: json.meta?.total_count ?? (json.data || []).length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
