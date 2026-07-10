import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ detailId: string }> }) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { detailId } = await params;
    const body = await request.json();

    const patchBody: Record<string, unknown> = {};
    if (body.qty !== undefined) patchBody.qty = Number(body.qty);
    if (body.unit_price !== undefined) patchBody.unit_price = Number(body.unit_price);
    if (body.uom !== undefined) patchBody.uom = body.uom;
    if (body.supplier !== undefined) patchBody.supplier = body.supplier === null ? null : Number(body.supplier);
    if (body.item_template_id !== undefined) patchBody.item_template_id = body.item_template_id === null ? null : Number(body.item_template_id);
    if (body.item_variant_id !== undefined) patchBody.item_variant_id = body.item_variant_id === null ? null : Number(body.item_variant_id);

    const q = patchBody.qty as number | undefined;
    const up = patchBody.unit_price as number | undefined;
    if (q !== undefined && up !== undefined) {
      patchBody.total_amount = q * up;
    } else if (q !== undefined) {
      const detailRes = await fetch(
        `${DIRECTUS_URL}/items/procurement_details/${detailId}?fields=unit_price`,
        {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          cache: "no-store",
        }
      );
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        const currentUnitPrice = Number((detailData.data as Record<string, unknown> | undefined)?.unit_price) || 0;
        patchBody.total_amount = q * currentUnitPrice;
      }
    } else if (up !== undefined) {
      const detailRes = await fetch(
        `${DIRECTUS_URL}/items/procurement_details/${detailId}?fields=qty`,
        {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          cache: "no-store",
        }
      );
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        const currentQty = Number((detailData.data as Record<string, unknown> | undefined)?.qty) || 0;
        patchBody.total_amount = currentQty * up;
      }
    }

    const res = await fetch(`${DIRECTUS_URL}/items/procurement_details/${detailId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (data.data?.procurement_id) {
      await recomputeProcurementTotal(data.data.procurement_id);
    }

    return NextResponse.json(data.data);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ detailId: string }> }) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { detailId } = await params;

    const detailRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details/${detailId}?fields=procurement_id`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    const detailData = await detailRes.json();
    const procurementId = detailData.data?.procurement_id;

    await fetch(`${DIRECTUS_URL}/items/procurement_details/${detailId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });

    if (procurementId) {
      await recomputeProcurementTotal(procurementId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}

async function recomputeProcurementTotal(procurementId: number) {
  try {
    const detailsRes = await fetch(
      `${DIRECTUS_URL}/items/procurement_details?filter[procurement_id][_eq]=${procurementId}&fields=total_amount`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );
    if (!detailsRes.ok) return;
    const detailsData = await detailsRes.json();
    const total = (detailsData.data || []).reduce(
      (sum: number, d: Record<string, unknown>) => sum + (Number(d.total_amount) || 0),
      0
    );

    await fetch(`${DIRECTUS_URL}/items/procurement/${procurementId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ total_amount: total }),
      cache: "no-store",
    });
  } catch {
    // silent — total recomputation is best-effort
  }
}
