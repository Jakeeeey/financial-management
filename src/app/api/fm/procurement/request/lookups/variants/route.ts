import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const tmplId = request.nextUrl.searchParams.get("item_tmpl_id") || "";
    if (!tmplId) return NextResponse.json({ data: [] });
    const filter = { _and: [{ item_tmpl_id: { _eq: Number(tmplId) } }, { active: { _eq: true } }] };
    const res = await fetch(
      `${DIRECTUS_URL}/items/item_variant?fields=id,name,sku,list_price,uom_id,uom_id.unit_name,uom_id.unit_shortcut&filter=${encodeURIComponent(JSON.stringify(filter))}`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const rows = (data.data || []).map((r: Record<string, unknown>) => {
      const unit = r.uom_id as Record<string, unknown> | null;
      return {
        ...r,
        uom_id: typeof r.uom_id === "number" ? r.uom_id : (unit?.unit_id ?? null),
        uom: unit?.unit_name ?? unit?.unit_shortcut ?? null,
      };
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
