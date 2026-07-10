import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const poId = Number(id);
    const body = await request.json();
    const { rows, reference_no, notes, received_by, currentUserId } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ message: "Validation Error", detail: "No items to receive" }, { status: 400 });
    }

    const headerRes = await fetch(`${DIRECTUS_URL}/items/receiving`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        purchase_order_id: poId,
        received_by: received_by ?? currentUserId ?? null,
        reference_no: reference_no || null,
        notes: notes || null,
        received_date: new Date().toISOString().split("T")[0],
      }),
      cache: "no-store",
    });
    if (!headerRes.ok) throw new Error(await headerRes.text());
    const headerJson = await headerRes.json();
    const receivingId = headerJson.data?.id;
    if (!receivingId) throw new Error("Failed to create receiving header");

    for (const row of rows) {
      if (!row.received_today || row.received_today <= 0) continue;

      const qtyToSave = Math.max(0, Math.min(row.remaining, Number(row.received_today)));

      const lineRes = await fetch(`${DIRECTUS_URL}/items/receiving_item_lines`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          receiving_id: receivingId,
          po_item_id: row.po_item_id,
          item_template_id: row.item_template_id,
          ...(row.item_variant_id ? { item_variant_id: row.item_variant_id } : {}),
          uom: row.uom,
          qty_received: qtyToSave,
          unit_cost: Number(row.unit_cost),
          currency: row.currency ?? "PHP",
        }),
        cache: "no-store",
      });
      if (!lineRes.ok) throw new Error(await lineRes.text());
      const lineJson = await lineRes.json();
      const receivingLineId = lineJson.data?.id;
      if (!receivingLineId) throw new Error("Failed to create receiving line");

      if (row.splits && row.splits.length > 0) {
        const assignments = row.splits.map((split: Record<string, unknown>) => ({
          receiving_item_line_id: receivingLineId,
          department_id: Number(split.department_id),
          user_id: split.user_id ? Number(split.user_id) : null,
          qty_assigned: Number(split.qty),
          assigned_by: currentUserId ?? received_by ?? 1,
        }));

        const asgRes = await fetch(`${DIRECTUS_URL}/items/item_assignment`, {
          method: "POST",
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(assignments),
          cache: "no-store",
        });
        if (!asgRes.ok) throw new Error(await asgRes.text());
      }
    }

    // Determine new inventory_status
    const poItemsRes = await fetch(
      `${DIRECTUS_URL}/items/purchase_order_items?filter=${encodeURIComponent(JSON.stringify({ purchase_order_id: { _eq: poId } }))}&limit=-1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    const poItemsJson = await poItemsRes.json();
    const allItems: { id: number; qty: string | number }[] = poItemsJson.data || [];

    const receivingIdsRes = await fetch(
      `${DIRECTUS_URL}/items/receiving?filter=${encodeURIComponent(JSON.stringify({ purchase_order_id: { _eq: poId } }))}&fields=id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    const receivingIdsJson = await receivingIdsRes.json();
    const receivingIds: number[] = (receivingIdsJson.data || []).map((r: { id: number }) => r.id);

    const receivedMap: Record<number, number> = {};
    if (receivingIds.length > 0) {
      const linesRes = await fetch(
        `${DIRECTUS_URL}/items/receiving_item_lines?filter=${encodeURIComponent(JSON.stringify({ receiving_id: { _in: receivingIds } }))}&fields=po_item_id,qty_received&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      );
      const linesJson = await linesRes.json();
      for (const line of linesJson.data || []) {
        const pid = Number(line.po_item_id);
        receivedMap[pid] = (receivedMap[pid] || 0) + Number(line.qty_received || 0);
      }
    }

    const allFulfilled = allItems.every((item) => {
      const ordered = Number(item.qty || 0);
      const got = receivedMap[item.id] || 0;
      return got >= ordered;
    });

    const newStatus = allFulfilled ? "full" : "partial";
    await fetch(`${DIRECTUS_URL}/items/purchase_order/${poId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory_status: allFulfilled ? 6 : 5,
        status: newStatus,
        date_received: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    return NextResponse.json({ success: true, receiving_id: receivingId, status: newStatus }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
