import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const poRes = await fetch(
      `${DIRECTUS_URL}/items/purchase_order/${id}?fields=*`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!poRes.ok) throw new Error("Failed to fetch purchase order");
    const poJson = await poRes.json();
    const po = poJson.data;

    // Resolve supplier name
    let _supplier_name: string | null = null;
    if (po?.supplier_name) {
      try {
        const supRes = await fetch(
          `${DIRECTUS_URL}/items/suppliers/${po.supplier_name}?fields=supplier_name`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        );
        if (supRes.ok) {
          const supJson = await supRes.json();
          _supplier_name = supJson.data?.supplier_name ?? null;
        }
      } catch { /* supplier lookup is best-effort */ }
    }
    if (po) po._supplier_name = _supplier_name;
    if (!po) {
      return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });
    }

    const itemsRes = await fetch(
      `${DIRECTUS_URL}/items/purchase_order_items?filter=${encodeURIComponent(JSON.stringify({ purchase_order_id: { _eq: Number(id) } }))}&fields=*,item_template_id.name,item_variant_id.name&sort=line_no`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!itemsRes.ok) throw new Error("Failed to fetch PO items");
    const itemsJson = await itemsRes.json();
    const items = itemsJson.data || [];

    // Fetch received quantities
    const recvHeadersRes = await fetch(
      `${DIRECTUS_URL}/items/receiving?filter=${encodeURIComponent(JSON.stringify({ purchase_order_id: { _eq: Number(id) } }))}&fields=id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!recvHeadersRes.ok) throw new Error("Failed to fetch receiving headers");
    const recvHeadersJson = await recvHeadersRes.json();
    const recvIds: number[] = (recvHeadersJson.data || []).map((r: { id: number }) => r.id);

    const received: Record<number, number> = {};
    if (recvIds.length > 0) {
      const linesRes = await fetch(
        `${DIRECTUS_URL}/items/receiving_item_lines?filter=${encodeURIComponent(JSON.stringify({ receiving_id: { _in: recvIds } }))}&fields=po_item_id,qty_received&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      );
      if (linesRes.ok) {
        const linesJson = await linesRes.json();
        for (const line of linesJson.data || []) {
          const pid = Number(line.po_item_id);
          received[pid] = (received[pid] || 0) + Number(line.qty_received || 0);
        }
      }
    }

    return NextResponse.json({
      data: {
        po,
        items,
        received,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();

    const res = await fetch(`${DIRECTUS_URL}/items/purchase_order/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
