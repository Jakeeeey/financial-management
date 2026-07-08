import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

function generatePONumber(): string {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `PO-${year}-${rand}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const encoder_id = body.encoder_id;

    const masterRes = await fetch(
      `${DIRECTUS_URL}/items/procurement/${id}?fields=*,supplier_id.*`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!masterRes.ok) throw new Error(await masterRes.text());
    const masterData = await masterRes.json();
    const pr = masterData.data;

    if (!pr) {
      return NextResponse.json({ message: "Procurement not found" }, { status: 404 });
    }
    if (!pr.isApproved) {
      return NextResponse.json({ message: "Procurement must be approved before generating PO" }, { status: 400 });
    }
    if (pr.po_no) {
      return NextResponse.json({ message: "PO already generated for this procurement" }, { status: 400 });
    }

    const detailsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter[procurement_id][_eq]=${id}`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!detailsRes.ok) throw new Error(await detailsRes.text());
    const detailsData = await detailsRes.json();
    const details = detailsData.data || [];

    const totalAmount = details.reduce(
      (sum: number, d: Record<string, unknown>) => sum + (Number(d.total_amount) || 0),
      0
    );

    const purchaseOrderNo = generatePONumber();
    const now = new Date().toISOString();

    const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        purchase_order_no: purchaseOrderNo,
        supplier_name: pr.supplier_id,
        date: now.split("T")[0],
        time: now.split("T")[1]?.split(".")[0],
        total_amount: totalAmount,
        price_type: "General Receive Price",
        receiving_type: 3,
        inventory_status: 0,
        payment_status: 0,
        remark: pr.procurement_no,
        reference: String(pr.id),
      }),
      cache: "no-store",
    });

    if (!poRes.ok) throw new Error(await poRes.text());
    const poData = await poRes.json();
    const purchaseOrderId = poData.data?.purchase_order_id ?? poData.data?.id;

    if (!purchaseOrderId) throw new Error("Failed to get PO ID");

    for (const d of details) {
      const qty = Number(d.qty) || 0;
      const unitPrice = Number(d.unit_price) || 0;
      const subtotal = qty * unitPrice;
      const taxRate = 12;
      const taxAmount = subtotal * (taxRate / 100);
      const lineTotal = subtotal + taxAmount;

      const poItemRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchase_order_id: purchaseOrderId,
          item_name: d.item_name || "",
          item_description: d.item_description || null,
          uom: d.uom || null,
          qty,
          unit_price: unitPrice,
          line_subtotal: subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          line_total: lineTotal,
          expected_date: pr.lead_date || now.split("T")[0],
          procurement_id: Number(id),
          procurement_detail_id: d.id,
          supplier_id: pr.supplier_id,
          item_template_id: d.item_template_id?.id ?? d.item_template_id,
          item_variant_id: d.item_variant_id?.id ?? d.item_variant_id,
          currency: "PHP",
        }),
        cache: "no-store",
      });

      if (!poItemRes.ok) {
        const errText = await poItemRes.text();
        console.error("Failed to create PO item:", errText);
      }
    }

    await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ po_no: purchaseOrderId }),
      cache: "no-store",
    });

    return NextResponse.json({
      purchase_order_id: purchaseOrderId,
      purchase_order_no: purchaseOrderNo,
    }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
