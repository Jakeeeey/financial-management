import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({ name: { _icontains: search } });
    }

    if (andConditions.length === 1) {
      Object.assign(filter, andConditions[0]);
    } else if (andConditions.length > 1) {
      filter._and = andConditions;
    }

    const params = new URLSearchParams({
      fields: "*,item_tmpl_id.name",
      sort: "-created_at",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
    });
    if (Object.keys(filter).length) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const rows: Record<string, unknown>[] = (json.data || []).map(
      (r: Record<string, unknown>) => {
        const tmpl = r.item_tmpl_id as Record<string, unknown> | null;
        return {
          ...r,
          item_tmpl_id: typeof r.item_tmpl_id === "number" ? r.item_tmpl_id : (tmpl?.id ?? r.item_tmpl_id ?? null),
          _template_name: tmpl?.name ?? "\u2014",
        };
      }
    );

    return NextResponse.json({
      data: rows,
      total: json.meta?.total_count ?? rows.length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_tmpl_id, name, list_price, sku } = body;

    if (!item_tmpl_id) {
      return NextResponse.json({ message: "Template is required" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ message: "Variant name is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      item_tmpl_id: Number(item_tmpl_id),
      name: name.trim(),
      active: true,
    };
    if (list_price != null) payload.list_price = Number(list_price);
    if (sku?.trim()) payload.sku = sku.trim();

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json({ data: data.data }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
