import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function recomputeGrandTotal(procurementId: number) {
  const res = await fetch(
    `${DIRECTUS_URL}/items/procurement_details?filter=${encodeURIComponent(JSON.stringify({ procurement_id: { _eq: procurementId } }))}&fields=total_amount`,
    { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
  );
  if (!res.ok) return;
  const data = await res.json();
  const total = (data.data || []).reduce((s: number, d: Record<string, unknown>) => s + (Number(d.total_amount) || 0), 0);
  await fetch(`${DIRECTUS_URL}/items/procurement/${procurementId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ total_amount: total }),
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { procurement_id, item_template_id, item_variant_id, qty, unit_price, uom } = body;

    const total = (Number(qty) || 0) * (Number(unit_price) || 0);

    const res = await fetch(`${DIRECTUS_URL}/items/procurement_details`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        procurement_id, item_template_id, item_variant_id,
        qty, unit_price, total_amount: total, uom,
        date_added: new Date().toISOString().split("T")[0],
        supplier: null,
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    await recomputeGrandTotal(procurement_id);

    return NextResponse.json(data.data || {}, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ detailId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { detailId } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (body.qty !== undefined) patch.qty = Number(body.qty);
    if (body.unit_price !== undefined) patch.unit_price = Number(body.unit_price);
    if (body.uom !== undefined) patch.uom = body.uom;
    if (body.item_template_id !== undefined) patch.item_template_id = body.item_template_id;
    if (body.item_variant_id !== undefined) patch.item_variant_id = body.item_variant_id;

    if (patch.qty !== undefined || patch.unit_price !== undefined) {
      const q = (patch.qty as number) ?? 0;
      const p = (patch.unit_price as number) ?? 0;
      patch.total_amount = q * p;
    }

    const res = await fetch(`${DIRECTUS_URL}/items/procurement_details/${detailId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // Recompute grand total on procurement master
    const detailRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details/${detailId}?fields=procurement_id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      const pid = detailData.data?.procurement_id;
      if (pid) await recomputeGrandTotal(pid);
    }

    return NextResponse.json(data.data || {});
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ detailId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { detailId } = await params;

    const detailRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details/${detailId}?fields=procurement_id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    let parentId: number | null = null;
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      parentId = detailData.data?.procurement_id ?? null;
    }

    const res = await fetch(`${DIRECTUS_URL}/items/procurement_details/${detailId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());

    if (parentId) await recomputeGrandTotal(parentId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
