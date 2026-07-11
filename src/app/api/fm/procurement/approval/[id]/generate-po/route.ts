import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function nowManila(): { iso: string; date: string; time: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manila = new Date(utc + 8 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = manila.getFullYear();
  const M = pad(manila.getMonth() + 1);
  const d = pad(manila.getDate());
  const h = pad(manila.getHours());
  const m = pad(manila.getMinutes());
  const s = pad(manila.getSeconds());
  return {
    iso: `${y}-${M}-${d}T${h}:${m}:${s}.000Z`,
    date: `${y}-${M}-${d}`,
    time: `${h}:${m}:${s}`,
  };
}

async function resolveUserId(jwtEmail: string | null | undefined): Promise<number | null> {
  if (!jwtEmail) return null;
  try {
    const userRes = await fetch(
      `${DIRECTUS_URL}/items/user?filter[user_email][_eq]=${encodeURIComponent(jwtEmail)}&fields=user_id&limit=1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!userRes.ok) return null;
    const userJson = await userRes.json();
    const user = userJson.data?.[0];
    return user?.user_id ?? null;
  } catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    // Fetch procurement WITHOUT relation expansion (matching old system —
    // expanded objects cause JSON.stringify(NaN) → null issues with Directus)
    const masterRes = await fetch(
      `${DIRECTUS_URL}/items/procurement/${id}`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!masterRes.ok) throw new Error("Failed to fetch procurement");
    const masterData = await masterRes.json();
    const master = masterData.data;

    if (!master || !master.isApproved) {
      return NextResponse.json({ message: "Validation Error", detail: "Procurement is not approved" }, { status: 400 });
    }

    if (!master.supplier_id) {
      return NextResponse.json({ message: "Validation Error", detail: "Procurement has no supplier" }, { status: 400 });
    }
    const supplierId = Number(master.supplier_id);

    const detailsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter=${encodeURIComponent(JSON.stringify({ procurement_id: { _eq: Number(id) } }))}&fields=*,item_template_id.name,item_variant_id.name`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!detailsRes.ok) throw new Error("Failed to fetch details");
    const detailsData = await detailsRes.json();
    const rawDetails = detailsData.data || [];

    // Flatten relational fields — Directus returns objects when using fields=*,item_template_id.name
    const details = rawDetails.map((d: Record<string, unknown>) => {
      const tpl = d.item_template_id as Record<string, unknown> | null;
      const vr = d.item_variant_id as Record<string, unknown> | null;
      return {
        ...d,
        item_template_id: tpl?.id ?? null,
        item_variant_id: vr?.id ?? null,
        _template_name: tpl?.name ?? null,
        _variant_name: vr?.name ?? null,
      };
    });

    const to2 = (n: number) => Math.round(n * 100) / 100;

    // Compute real total_amount from details
    const computedTotal = to2(
      details.reduce(
        (a: number, b: Record<string, unknown>) =>
          a + (Number(b.total_amount ?? 0) || Number(b.qty || 0) * Number(b.unit_price || 0)),
        0
      )
    );

    const decoded = token ? (() => {
      try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      } catch { return null; }
    })() : null;
    const encoderEmail = decoded?.email || decoded?.sub || null;
    const encoderUserId = await resolveUserId(encoderEmail);

    const now = nowManila();
    const poNo = `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;

    const poBody: Record<string, unknown> = {
      purchase_order_no: poNo,
      supplier_name: supplierId,
      date: now.date,
      time: now.time,
      datetime: now.iso,
      date_encoded: now.iso,
      encoder_id: encoderUserId,
      approver_id: master.approved_by ?? null,
      total_amount: computedTotal,
      price_type: "General Receive Price",
      payment_status: 1,
      payment_type: 0,
      receiving_type: 3,
      inventory_status: 3, // For Receiving
      transaction_type: 1,
      receipt_required: 1,
      remark: master.procurement_no ?? "",
      reference: String(master.id),
    };

    const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(poBody),
      cache: "no-store",
    });
    if (!poRes.ok) throw new Error(await poRes.text());
    const poData = await poRes.json();
    const purchaseOrderId = poData.data?.purchase_order_id;
    if (!purchaseOrderId) throw new Error("Failed to get PO ID");

    let lineNo = 1;
    for (const d of details) {
      const qty = Number(d.qty) || 0;
      const unitPrice = Number(d.unit_price) || 0;
      const subtotal = to2(qty * unitPrice);
      const taxRate = 0;
      const taxAmount = to2(subtotal * (taxRate / 100));
      const discountAmount = 0;
      const lineTotal = to2(subtotal - discountAmount + taxAmount);

      // Resolve item name from variant/template (separate fetch since we flattened the FK)
      let itemName = d._variant_name as string | undefined;
      if (!itemName) itemName = d._template_name as string | undefined;
      if (!itemName) {
        // Fallback: try to resolve from existing lookup tables
        itemName = "Non-trade Item";
      }

      const poItem: Record<string, unknown> = {
        purchase_order_id: purchaseOrderId,
        line_no: lineNo++,
        item_name: itemName,
        item_description: null,
        uom: d.uom || null,
        qty,
        unit_price: unitPrice,
        line_subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        line_total: lineTotal,
        expected_date: master.lead_date || null,
        notes: null,
        procurement_id: Number(id),
        procurement_detail_id: d.id,
        supplier_id: Number(supplierId),
        item_template_id: d.item_template_id ?? null,
        item_variant_id: d.item_variant_id ?? null,
        currency: "PHP",
        encoder_id: encoderUserId,
        department_id: master.department_id ?? null,
        created_at: now.iso,
        updated_at: now.iso,
      };

      const itemRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(poItem),
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
