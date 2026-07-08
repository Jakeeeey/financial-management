import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { procurement_id, item_name, qty, unit_price, uom, supplier } = body;

    if (!procurement_id || !item_name || qty === undefined || unit_price === undefined) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const total_amount = Number(qty) * Number(unit_price);

    const createBody: Record<string, unknown> = {
      procurement_id: Number(procurement_id),
      item_name: String(item_name),
      qty: Number(qty),
      unit_price: Number(unit_price),
      total_amount,
    };
    if (uom) createBody.uom = String(uom);
    if (supplier !== undefined && supplier !== null) createBody.supplier = Number(supplier);

    const res = await fetch(`${DIRECTUS_URL}/items/procurement_details`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
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
    // silent
  }
}
