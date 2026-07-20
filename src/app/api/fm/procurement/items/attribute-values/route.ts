import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attribute_id, name, extra_price } = body;

    if (!attribute_id) {
      return NextResponse.json({ message: "Attribute ID is required" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ message: "Value name is required" }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attribute_id: Number(attribute_id),
        name: name.trim(),
        extra_price: extra_price != null ? Number(extra_price) : 0,
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
      fields: "id,attribute_id,name,extra_price,created_at",
      sort: "name",
      limit,
    });

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ data: json.data || [] });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
