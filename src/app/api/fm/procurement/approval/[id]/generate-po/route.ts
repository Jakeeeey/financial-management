import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const masterRes = await fetch(
      `${DIRECTUS_URL}/items/procurement/${id}?fields=*,supplier_id.supplier_name,encoder_id.*`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!masterRes.ok) throw new Error("Failed to fetch procurement");
    const masterData = await masterRes.json();
    const master = masterData.data;

    if (!master || !master.isApproved) {
      return NextResponse.json({ message: "Validation Error", detail: "Procurement is not approved" }, { status: 400 });
    }

    const detailsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter=${encodeURIComponent(JSON.stringify({ procurement_id: { _eq: Number(id) } }))}&fields=*,item_template_id.name,item_variant_id.name`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!detailsRes.ok) throw new Error("Failed to fetch details");
    const detailsData = await detailsRes.json();
    const details = detailsData.data || [];

    const enc = master.encoder_id as Record<string, unknown> | null | undefined;

    const poNo = `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;

    let totalAmount = 0;
    const poItems = details.map((d: Record<string, unknown>) => {
      const qty = Number(d.qty) || 0;
      const unit_price = Number(d.unit_price) || 0;
      const subtotal = qty * unit_price;
      totalAmount += subtotal;
      return {
        purchase_order_no: poNo,
        procurement_id: Number(id),
        item_template_id: d.item_template_id,
        item_variant_id: d.item_variant_id,
        item_name: ((d.item_template_id as Record<string, unknown> | null)?.name as string) ?? null,
        item_description: null,
        qty,
        unit_price,
        total_amount: subtotal,
        uom: d.uom as string,
        supplier_id: master.supplier_id,
        link: d.link as string,
        date_added: new Date().toISOString().split("T")[0],
      };
    });

    const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        purchase_order_no: poNo,
        procurement_id: Number(id),
        supplier_id: master.supplier_id,
        encoder_id: (enc?.id as number) ?? master.encoder_id,
        lead_date: master.lead_date,
        total_amount: totalAmount,
        status: "pending",
        transaction_type: master.transaction_type,
      }),
      cache: "no-store",
    });

    if (!poRes.ok) throw new Error(await poRes.text());
    const poData = await poRes.json();
    const purchaseOrderId = poData.data?.id;
    if (!purchaseOrderId) throw new Error("Failed to get PO ID");

    for (const item of poItems) {
      item.purchase_order_id = purchaseOrderId;
      const itemRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(item),
        cache: "no-store",
      });
      if (!itemRes.ok) throw new Error(await itemRes.text());
    }

    await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ po_no: purchaseOrderId }),
      cache: "no-store",
    });

    return NextResponse.json({ purchase_order_id: purchaseOrderId, purchase_order_no: poNo }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
