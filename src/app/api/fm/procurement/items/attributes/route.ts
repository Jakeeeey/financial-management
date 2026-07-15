import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit")) || -1));

    const params = new URLSearchParams({
      fields: "*,attribute_values.*",
      sort: "name",
      limit: String(limit),
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

    return NextResponse.json({ data: rows });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
