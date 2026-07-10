import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const [masterRes, detailsRes] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/procurement/${id}?fields=*,supplier_id.*,encoder_id.*`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store",
      }),
      fetch(`${DIRECTUS_URL}/items/procurement_details?filter=${encodeURIComponent(JSON.stringify({ procurement_id: { _eq: Number(id) } }))}&fields=*,item_template_id.name,item_variant_id.name`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store",
      }),
    ]);

    if (!masterRes.ok) throw new Error(await masterRes.text());
    if (!detailsRes.ok) throw new Error(await detailsRes.text());

    const masterData = await masterRes.json();
    const detailsData = await detailsRes.json();

    const m = masterData.data || {};
    const sid = m.supplier_id as Record<string, unknown> | null | undefined;
    const eid = m.encoder_id as Record<string, unknown> | null | undefined;

    const master = {
      id: m.id as number, procurement_no: m.procurement_no as string,
      supplier_id: (sid?.id as number) ?? (m.supplier_id as number),
      lead_date: m.lead_date as string, total_amount: m.total_amount as number,
      created_at: m.created_at as string, updated_at: m.updated_at as string,
      encoder_id: (eid?.id as number) ?? (m.encoder_id as number),
      department_id: m.department_id as number,
      po_no: m.po_no as number, isApproved: m.isApproved as number,
      approved_by: m.approved_by as number, approved_date: m.approved_date as string,
      transaction_type: m.transaction_type as string, status: m.status as string,
      supplier_name: (sid?.supplier_name as string) ?? null,
      supplier_email: (sid?.email_address as string) ?? null,
      supplier_phone: (sid?.phone_number as string) ?? null,
      supplier_address: (sid?.address as string) ?? null,
      supplier_tin: (sid?.tin_number as string) ?? null,
      supplier_payment_terms: (sid?.payment_terms as string) ?? null,
      encoder_name: eid ? `${(eid.first_name as string) ?? ""} ${(eid.last_name as string) ?? ""}`.trim() || null : null,
      department_name: null,
    };

    const details = (detailsData.data || []).map((d: Record<string, unknown>) => {
      const tid = d.item_template_id as Record<string, unknown> | null | undefined;
      const vid = d.item_variant_id as Record<string, unknown> | null | undefined;
      return {
        id: d.id as number, procurement_id: d.procurement_id as number,
        item_template_id: (tid?.id as number) ?? (d.item_template_id as number),
        item_variant_id: (vid?.id as number) ?? (d.item_variant_id as number),
        qty: Number(d.qty) || 0, unit_price: Number(d.unit_price) || 0,
        total_amount: Number(d.total_amount) || 0,
        date_added: (d.date_added as string) ?? null,
        supplier: d.supplier as number, link: d.link as string,
        created_at: d.created_at as string, updated_at: d.updated_at as string,
        uom: d.uom as string,
        template_name: (tid?.name as string) ?? null,
        variant_name: (vid?.name as string) ?? null,
      };
    });

    return NextResponse.json({ master, details });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
