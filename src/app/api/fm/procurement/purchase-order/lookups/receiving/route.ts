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
    const purchaseOrderId = searchParams.get("purchase_order_id");
    if (!purchaseOrderId) {
      return NextResponse.json({ data: [] });
    }

    const filter = JSON.stringify({ purchase_order_id: { _eq: Number(purchaseOrderId) } });
    const res = await fetch(
      `${DIRECTUS_URL}/items/receiving?filter=${encodeURIComponent(filter)}&fields=id&limit=-1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ data: json.data || [] });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
