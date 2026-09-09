import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

// Single source of truth = procurement table. Summary rows are procurement
// rows with a commercial PO link (po_no non-null). procurement carries no
// inventory_status, so the receive flow maintains procurement.status in the
// vocabularies below and the list maps them back to PO inventory codes
// (3 = open/for-receiving, 9 = partial, 6 = full, 7 = cancelled).
const PARTIAL_STATES = ["Partially Received", "partially received"];
const FULL_STATES = ["Fully Received", "fully received", "Full", "full"];
const CANCELLED_STATES = ["Rejected", "rejected", "Cancelled", "cancelled"];

export function inventoryFromProcurementStatus(status: unknown): number {
  const s = String(status ?? "");
  if (FULL_STATES.includes(s)) return 6;
  if (PARTIAL_STATES.includes(s)) return 9;
  if (CANCELLED_STATES.includes(s)) return 7;
  return 3;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const statusRaw = searchParams.get("status") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    // po_no linkage: only procurement rows with a non-null po_no are summary rows.
    const andConditions: Record<string, unknown>[] = [{ po_no: { _nnull: true } }];

    if (search) {
      andConditions.push({ procurement_no: { _icontains: search } });
    }
    if (statusRaw && statusRaw !== "_all") {
      if (statusRaw === "pending" || statusRaw === "open") {
        andConditions.push({
          status: { _nin: [...PARTIAL_STATES, ...FULL_STATES, ...CANCELLED_STATES] },
        });
      } else if (statusRaw === "partial") {
        andConditions.push({ status: { _in: PARTIAL_STATES } });
      } else if (statusRaw === "full") {
        andConditions.push({ status: { _in: FULL_STATES } });
      } else if (statusRaw === "cancelled") {
        andConditions.push({ status: { _in: CANCELLED_STATES } });
      }
    }

    const filter: Record<string, unknown> =
      andConditions.length === 1 ? andConditions[0] : { _and: andConditions };

    const params = new URLSearchParams({
      fields: "*,supplier_id.supplier_name",
      sort: "-id",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
      filter: JSON.stringify(filter),
    });

    const res = await fetch(`${DIRECTUS_URL}/items/procurement?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const rows: Record<string, unknown>[] = json.data || [];

    // Map procurement rows onto the existing PO list shape. URL identity stays
    // the procurement id; purchase_order_id/po_no preserve the commercial link
    // so detail + receive resolve the same row.
    const enriched = rows.map((r: Record<string, unknown>) => {
      const sid = r.supplier_id as Record<string, unknown> | null | undefined;
      const supplierId =
        sid && typeof sid.id !== "undefined" && sid.id !== null
          ? Number(sid.id)
          : r.supplier_id !== null && typeof r.supplier_id !== "undefined"
            ? Number(r.supplier_id)
            : null;
      const poId = Number(r.po_no);
      return {
        ...r,
        id: r.id,
        purchase_order_id: poId,
        po_no: poId,
        procurement_id: r.id,
        purchase_order_no: r.procurement_no,
        supplier_name: supplierId,
        _supplier_name: (sid?.supplier_name as string) ?? null,
        date: (r.lead_date as string) ?? null,
        inventory_status: inventoryFromProcurementStatus(r.status),
        remark: (r.procurement_no as string) ?? null,
        date_approved: (r.approved_date as string) ?? null,
      };
    });

    return NextResponse.json({
      data: enriched,
      total: json.meta?.total_count ?? enriched.length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
