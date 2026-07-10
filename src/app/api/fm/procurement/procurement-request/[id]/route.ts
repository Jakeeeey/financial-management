import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const masterRes = await fetch(
      `${DIRECTUS_URL}/items/procurement/${id}?fields=*,supplier_id.*,encoder_id.*,department_id.*`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!masterRes.ok) throw new Error(await masterRes.text());
    const masterData = await masterRes.json();
    if (!masterData.data) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const r = masterData.data;
    const master = {
      id: r.id,
      procurement_no: r.procurement_no,
      supplier_id: r.supplier_id?.id ?? r.supplier_id,
      lead_date: r.lead_date,
      total_amount: r.total_amount,
      created_at: r.created_at,
      updated_at: r.updated_at,
      encoder_id: r.encoder_id?.id ?? r.encoder_id,
      department_id: r.department_id?.id ?? r.department_id,
      po_no: r.po_no,
      isApproved: r.isApproved,
      approved_by: r.approved_by,
      approved_date: r.approved_date,
      transaction_type: r.transaction_type,
      status: r.status,
      supplier_name: r.supplier_id?.supplier_name ?? null,
      supplier_email: r.supplier_id?.email_address ?? null,
      supplier_phone: r.supplier_id?.phone_number ?? null,
      supplier_address: r.supplier_id?.address ?? null,
      supplier_tin: r.supplier_id?.tin_number ?? null,
      supplier_payment_terms: r.supplier_id?.payment_terms ?? null,
      supplier_type: r.supplier_id?.supplier_type ?? null,
      encoder_name: r.encoder_id
        ? `${r.encoder_id.first_name ?? ""} ${r.encoder_id.last_name ?? ""}`.trim() || null
        : null,
      department_name: r.department_id?.name ?? null,
    };

    const detailsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter[procurement_id][_eq]=${id}&sort=id&fields=*,item_template_id.name,item_variant_id.name`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!detailsRes.ok) throw new Error(await detailsRes.text());
    const detailsData = await detailsRes.json();

    const details = (detailsData.data || []).map((d: Record<string, unknown>) => {
      const itid = d.item_template_id as Record<string, unknown> | null | undefined;
      const ivid = d.item_variant_id as Record<string, unknown> | null | undefined;
      return {
        id: d.id as number,
        procurement_id: d.procurement_id as number,
        item_variant_id: (ivid?.id as number) ?? (d.item_variant_id as number),
        item_template_id: (itid?.id as number) ?? (d.item_template_id as number),
        qty: d.qty as number,
        unit_price: d.unit_price as number,
        total_amount: d.total_amount as number,
        date_added: d.date_added as string,
        supplier: d.supplier as number,
        link: d.link as string,
        created_at: d.created_at as string,
        updated_at: d.updated_at as string,
        uom: d.uom as string,
        template_name: (itid?.name as string) ?? null,
        variant_name: (ivid?.name as string) ?? null,
        supplier_name: null as string | null,
      };
    });

    return NextResponse.json({ master, details });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const res = await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json(data.data);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
