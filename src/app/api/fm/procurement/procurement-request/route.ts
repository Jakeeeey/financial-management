import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

function generatePRNumber(supplierType: string | null): string {
  let prefix = "PR";
  const type = (supplierType || "").toUpperCase();
  if (type.includes("TRADE")) prefix = "PRTR";
  else if (type.includes("NON") || type.includes("NON-TRADE")) prefix = "PRNT";
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `${prefix}-${year}-${rand}`;
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const supplier_id = searchParams.get("supplier_id") || "";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const offset = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = { _eq: status };
    if (supplier_id) filter.supplier_id = { _eq: Number(supplier_id) };
    if (q) {
      filter._or = [
        { procurement_no: { _contains: q } },
        { status: { _contains: q } },
      ];
    }

    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      sort: "-created_at",
      meta: "filter_count,total_count",
      fields: "*,supplier_id.supplier_name,encoder_id.*,department_id.*",
    });
    if (Object.keys(filter).length > 0) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(
      `${DIRECTUS_URL}/items/procurement?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const rows = (data.data || []).map((r: Record<string, unknown>) => ({
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
      encoder_name: r.encoder_id
        ? `${r.encoder_id.first_name ?? ""} ${r.encoder_id.last_name ?? ""}`.trim() || null
        : null,
      department_name: r.department_id?.name ?? null,
    }));

    return NextResponse.json({
      data: rows,
      meta: data.meta || {},
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { supplier_id, lead_date, encoder_id, department_id, transaction_type, status, items } = body;

    if (!supplier_id || !items?.length) {
      return NextResponse.json(
        { message: "Validation Error", detail: "Supplier and at least one item are required" },
        { status: 400 }
      );
    }

    const supplierRes = await fetch(
      `${DIRECTUS_URL}/items/suppliers/${supplier_id}?fields=supplier_type,supplier_name`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!supplierRes.ok) throw new Error("Failed to fetch supplier");
    const supplierData = await supplierRes.json();
    const supplierType = supplierData.data?.supplier_type ?? null;

    const procurement_no = generatePRNumber(supplierType);

    const masterRes = await fetch(`${DIRECTUS_URL}/items/procurement`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        procurement_no,
        supplier_id,
        lead_date,
        encoder_id,
        department_id: department_id || null,
        transaction_type: transaction_type || "trade",
        status: status || "pending",
        total_amount: 0,
      }),
      cache: "no-store",
    });

    if (!masterRes.ok) throw new Error(await masterRes.text());
    const masterData = await masterRes.json();
    const procurementId = masterData.data?.id;
    if (!procurementId) throw new Error("Failed to get procurement ID");

    let grandTotal = 0;
    const detailInserts = items.map((item: Record<string, unknown>) => {
      const qty = Number(item.qty) || 0;
      const unit_price = Number(item.unit_price) || 0;
      const total = qty * unit_price;
      grandTotal += total;
      return {
        procurement_id: procurementId,
        item_template_id: item.item_template_id || null,
        item_variant_id: item.item_variant_id || null,
        item_name: item.item_name || "",
        item_description: item.item_description || null,
        uom: item.uom || null,
        qty,
        unit_price,
        total_amount: total,
        date_added: new Date().toISOString().split("T")[0],
        supplier: supplier_id,
      };
    });

    for (const detail of detailInserts) {
      const detailRes = await fetch(`${DIRECTUS_URL}/items/procurement_details`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(detail),
        cache: "no-store",
      });
      if (!detailRes.ok) throw new Error(await detailRes.text());
    }

    await fetch(`${DIRECTUS_URL}/items/procurement/${procurementId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ total_amount: grandTotal }),
      cache: "no-store",
    });

    return NextResponse.json({ id: procurementId, procurement_no }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
