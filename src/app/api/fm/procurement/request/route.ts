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
    const { supplier_id, lead_date, department_id, transaction_type, status, items } = body;

    let encoder_id: number | null = null;
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
        const userId = payload?.id || payload?.user_id || payload?.sub;
        if (userId) {
          const userRes = await fetch(
            `${DIRECTUS_URL}/items/user/${userId}?fields=user_id`,
            { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
          );
          if (userRes.ok) {
            const userData = await userRes.json();
            const uid = userData?.data?.user_id ?? userData?.data?.id;
            if (uid) encoder_id = Number(uid);
          }
        }
      } catch {
        // fallback
      }
    }

    if (!supplier_id || !items?.length) {
      return NextResponse.json(
        { message: "Validation Error", detail: "Supplier and at least one item are required" },
        { status: 400 }
      );
    }

    const supplierRes = await fetch(
      `${DIRECTUS_URL}/items/suppliers/${supplier_id}?fields=supplier_type,supplier_name`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!supplierRes.ok) throw new Error("Failed to fetch supplier");
    const supplierData = await supplierRes.json();
    const supplierType = supplierData.data?.supplier_type ?? null;

    const norm = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ");
    const prefix =
      norm(supplierType).includes("Trade") ? "PRTR" :
      norm(supplierType).includes("Non")   ? "PRNT" : "PR";
    const transactionType =
      prefix === "PRNT" ? "non-trade" :
      prefix === "PRTR" ? "trade" : null;
    const procurement_no = `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;

    const masterRes = await fetch(`${DIRECTUS_URL}/items/procurement`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        procurement_no, supplier_id, lead_date, encoder_id,
        department_id: department_id || null,
        transaction_type: transactionType,
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
        uom: item.uom || null,
        qty, unit_price,
        total_amount: total,
        date_added: new Date().toISOString().split("T")[0],
        supplier: supplier_id,
      };
    });

    for (const detail of detailInserts) {
      const detailRes = await fetch(`${DIRECTUS_URL}/items/procurement_details`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(detail),
        cache: "no-store",
      });
      if (!detailRes.ok) throw new Error(await detailRes.text());
    }

    await fetch(`${DIRECTUS_URL}/items/procurement/${procurementId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ total_amount: grandTotal }),
      cache: "no-store",
    });

    return NextResponse.json({ id: procurementId, procurement_no }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
