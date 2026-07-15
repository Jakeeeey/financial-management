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

    // Fetch the variant
    const res = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}?fields=*,item_tmpl_id.name`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const r = json.data as Record<string, unknown>;
    const tmpl = r.item_tmpl_id as Record<string, unknown> | null;

    // Fetch the variant's attribute value relations
    const relParams = new URLSearchParams({
      "filter[item_variant_id][_eq]": id,
      fields: "item_attribute_value_id",
    });
    const relRes = await fetch(
      `${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel?${relParams.toString()}`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    let valueIds: number[] = [];
    if (relRes.ok) {
      const relJson = await relRes.json();
      valueIds = ((relJson.data || []) as Record<string, unknown>[]).map(
        (rel) => (typeof rel.item_attribute_value_id === "number" ? rel.item_attribute_value_id : 0)
      ).filter(Boolean);
    }

    const resolved = {
      ...r,
      item_tmpl_id: typeof r.item_tmpl_id === "number" ? r.item_tmpl_id : (tmpl?.id ?? r.item_tmpl_id ?? null),
      _template_name: tmpl?.name ?? "\u2014",
      valueIds,
    };
    return NextResponse.json({ data: resolved });
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
    const { item_tmpl_id, name, list_price, sku, active } = body;

    const payload: Record<string, unknown> = {};
    if (item_tmpl_id !== undefined) payload.item_tmpl_id = Number(item_tmpl_id);
    if (name?.trim()) payload.name = name.trim();
    if (list_price !== undefined) payload.list_price = Number(list_price);
    if (sku !== undefined) payload.sku = sku?.trim() ?? null;
    if (active !== undefined) payload.active = active ? 1 : 0;

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}`, {
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
