import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_template/${id}?fields=*`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const variantRes = await fetch(
      `${DIRECTUS_URL}/items/item_variant?filter=${encodeURIComponent(JSON.stringify({ item_tmpl_id: { _eq: Number(id) } }))}&meta=total_count&limit=1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    let variantCount = 0;
    if (variantRes.ok) {
      const vJson = await variantRes.json();
      variantCount = vJson.meta?.total_count ?? 0;
    }

    return NextResponse.json({
      data: { ...json.data, _variant_count: variantCount },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, uom, base_price, description, is_active } = body;

    const payload: Record<string, unknown> = {};
    if (name?.trim()) payload.name = name.trim();
    if (uom !== undefined) payload.uom = uom;
    if (base_price !== undefined) payload.base_price = Number(base_price);
    if (description !== undefined) payload.description = description?.trim() ?? null;
    if (is_active !== undefined) payload.is_active = is_active ? 1 : 0;

    const res = await fetch(`${DIRECTUS_URL}/items/item_template/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
