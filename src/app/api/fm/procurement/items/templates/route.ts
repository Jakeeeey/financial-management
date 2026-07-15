import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit === "-1" ? -1 : Math.min(300, Math.max(1, Number(rawLimit) || 50));
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        _or: [
          { name: { _icontains: search } },
          { description: { _icontains: search } },
        ],
      });
    }

    if (andConditions.length === 1) {
      Object.assign(filter, andConditions[0]);
    } else if (andConditions.length > 1) {
      filter._and = andConditions;
    }

    const params = new URLSearchParams({
      fields: "*",
      sort: "name",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
    });
    if (Object.keys(filter).length) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_template?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const rows: Record<string, unknown>[] = json.data || [];

    const tmplIds = rows.map((r) => Number(r.id)).filter((id) => !Number.isNaN(id));
    if (tmplIds.length > 0) {
      try {
        const vRes = await fetch(
          `${DIRECTUS_URL}/items/item_variant?filter=${encodeURIComponent(JSON.stringify({ item_tmpl_id: { _in: tmplIds } }))}&fields=id,item_tmpl_id&limit=-1`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        );
        if (vRes.ok) {
          const vJson = await vRes.json();
          const countMap: Record<number, number> = {};
          for (const v of vJson.data || []) {
            const tid = Number(v.item_tmpl_id);
            if (tid) countMap[tid] = (countMap[tid] || 0) + 1;
          }
          for (const r of rows) {
            (r as Record<string, unknown>)._variant_count = countMap[Number(r.id)] || 0;
          }
        }
      } catch { /* variant count is best-effort */ }
    }

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
    const { name, uom, base_price, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      is_active: true,
    };
    if (uom != null) payload.uom = uom;
    if (base_price != null) payload.base_price = Number(base_price);
    if (description?.trim()) payload.description = description.trim();

    const res = await fetch(`${DIRECTUS_URL}/items/item_template`, {
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
