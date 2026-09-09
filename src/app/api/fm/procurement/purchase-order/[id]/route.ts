import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { inventoryFromProcurementStatus } from "../route";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    // {id} is the procurement id. The summary world only contains procurement
    // rows linked to a commercial PO (po_no non-null); anything else 404s.
    const { id } = await params;

    const procRes = await fetch(
      `${DIRECTUS_URL}/items/procurement/${id}?fields=*,supplier_id.*`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!procRes.ok) {
      return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });
    }
    const procJson = await procRes.json();
    const proc = procJson.data as Record<string, unknown> | null;
    if (!proc || proc.po_no === null || typeof proc.po_no === "undefined") {
      return NextResponse.json({ message: "Purchase order not found" }, { status: 404 });
    }
    const poId = Number(proc.po_no);

    // Supplier fields resolved from the expanded supplier object
    // (same field names as approval/[id]: supplier_name, email_address,
    // phone_number, address, tin_number, payment_terms).
    const sid = proc.supplier_id as Record<string, unknown> | null | undefined;
    const supplierId =
      sid && typeof sid.id !== "undefined" && sid.id !== null
        ? Number(sid.id)
        : proc.supplier_id !== null && typeof proc.supplier_id !== "undefined"
          ? Number(proc.supplier_id as number)
          : null;

    const po: Record<string, unknown> = {
      ...proc,
      id: proc.id,
      purchase_order_id: poId,
      po_no: poId,
      procurement_id: proc.id,
      purchase_order_no: proc.procurement_no,
      supplier_name: supplierId,
      _supplier_name: (sid?.supplier_name as string) ?? null,
      _supplier_address: (sid?.address as string) ?? null,
      _supplier_email: (sid?.email_address as string) ?? null,
      _supplier_phone: (sid?.phone_number as string) ?? null,
      _supplier_tin: (sid?.tin_number as string) ?? null,
      _supplier_payment_terms: (sid?.payment_terms as string) ?? null,
      date: (proc.lead_date as string) ?? null,
      inventory_status: inventoryFromProcurementStatus(proc.status),
      remark: (proc.procurement_no as string) ?? null,
      date_approved: (proc.approved_date as string) ?? null,
      date_received: null,
    };

    const itemsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter=${encodeURIComponent(JSON.stringify({ procurement_id: { _eq: Number(id) } }))}&fields=*,item_template_id.name,item_variant_id.name&sort=id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!itemsRes.ok) throw new Error("Failed to fetch PO items");
    const itemsJson = await itemsRes.json();
    const rawItems: Record<string, unknown>[] = itemsJson.data || [];

    // Map procurement_details onto the existing PO-item shape. Item identity
    // is the procurement_detail id (single source of truth); the receive flow
    // keys received quantities off the same ids.
    const items = rawItems.map((d: Record<string, unknown>, idx: number) => {
      const tpl = d.item_template_id as Record<string, unknown> | null | undefined;
      const vr = d.item_variant_id as Record<string, unknown> | null | undefined;
      const tplId =
        tpl && typeof tpl.id !== "undefined" && tpl.id !== null
          ? Number(tpl.id)
          : d.item_template_id !== null && typeof d.item_template_id !== "undefined"
            ? Number(d.item_template_id as number)
            : null;
      const vrId =
        vr && typeof vr.id !== "undefined" && vr.id !== null
          ? Number(vr.id)
          : d.item_variant_id !== null && typeof d.item_variant_id !== "undefined"
            ? Number(d.item_variant_id as number)
            : null;
      const tplName = (tpl?.name as string) ?? null;
      const vrName = (vr?.name as string) ?? null;
      const qty = Number(d.qty) || 0;
      const unitPrice = Number(d.unit_price) || 0;
      const total = Number(d.total_amount) || qty * unitPrice;
      return {
        ...d,
        id: d.id,
        po_item_id: d.id,
        purchase_order_id: poId,
        purchase_order_no: proc.procurement_no,
        line_no: idx + 1,
        item_name: vrName ?? tplName ?? "Non-trade Item",
        item_template_id: tplId,
        item_variant_id: vrId,
        qty,
        unit_price: unitPrice,
        total_amount: total,
        line_subtotal: total,
        line_total: total,
        uom: (d.uom as string) ?? null,
        supplier_id: d.supplier !== null && typeof d.supplier !== "undefined" ? Number(d.supplier as number) : supplierId,
      };
    });

    // Fetch received quantities. receiving.purchase_order_id still references
    // the commercial PO id, so headers are looked up by the linked po_no.
    const recvHeadersRes = await fetch(
      `${DIRECTUS_URL}/items/receiving?filter=${encodeURIComponent(JSON.stringify({ purchase_order_id: { _eq: poId } }))}&fields=id`,
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
    // {id} is the procurement id — generic updates re-pointed at the procurement row.
    const { id } = await params;
    const body = await request.json();

    const res = await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
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
