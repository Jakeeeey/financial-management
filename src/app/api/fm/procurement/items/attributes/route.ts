import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, display_type } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: "Attribute name is required" }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        display_type: display_type || "select",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    return NextResponse.json({ data: json.data }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" || !limitParam ? "-1" : String(Math.min(300, Math.max(1, Number(limitParam))));

    const params = new URLSearchParams({
      sort: "name",
      limit,
    });

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const rows = (json.data || []).map((r: Record<string, unknown>) => ({
      ...r,
      display_type: r.display_type || "select",
    }));

    const ids = rows.map((r: Record<string, unknown>) => r.id).filter(Boolean);
    const valuesByAttr: Record<number, unknown[]> = {};
    if (ids.length > 0) {
      const vRes = await fetch(
        `${DIRECTUS_URL}/items/item_attribute_value?fields=id,attribute_id,name,extra_price,created_at&sort=name&limit=-1&filter={"attribute_id":{"_in":[${ids.join(",")}]}}`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      );
      if (vRes.ok) {
        const vJson = await vRes.json();
        for (const v of vJson.data || []) {
          const aid = typeof v.attribute_id === "object" ? Number(v.attribute_id?.id) : Number(v.attribute_id);
          if (!valuesByAttr[aid]) valuesByAttr[aid] = [];
          valuesByAttr[aid].push({ ...v, attribute_id: aid });
        }
      }
    }

    const merged = rows.map((r: Record<string, unknown>) => ({
      ...r,
      attribute_values: valuesByAttr[Number(r.id)] || [],
    }));

    return NextResponse.json({ data: merged });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
