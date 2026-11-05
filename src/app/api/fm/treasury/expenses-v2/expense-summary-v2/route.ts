import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET() {
  try {
    const fields = [
      "id",
      "doc_no",
      "expense_date",
      "payee",
      "is_employee",
      "division_id",
      "department_id",
      "coa_id",
      "amount",
      "receipt_url",
      "remarks",
      "status",
      "current_approval_level",
      "is_final_approved",
      "disbursement_id",
      "disbursement_payable_id",
      "created_at",
      "created_by.user_id",
      "created_by.user_fname",
      "created_by.user_lname",
      "created_by.user_email",
    ].join(",");

    const filterUrl = `${API_BASE_URL}/items/expense?fields=${fields}&filter[is_deleted][_eq]=false&sort=-created_at&limit=-1`;

    const res = await fetch(filterUrl, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    const rawItems = data.data || [];

    if (rawItems.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Query expense_logs to check if any of these expenses have action == 'With Concern'
    const expenseIds = rawItems.map((item: { id?: number }) => item.id).filter(Boolean);
    const concernSet = new Set<number>();

    if (expenseIds.length > 0) {
      try {
        const logsUrl = `${API_BASE_URL}/items/expense_logs?filter[expense_id][_in]=${expenseIds.join(",")}&filter[action][_eq]=${encodeURIComponent("With Concern")}&fields=expense_id&limit=-1`;
        const logsRes = await fetch(logsUrl, {
          headers: AUTH_HEADERS,
          cache: "no-store",
        });

        if (logsRes.ok) {
          const logsJson = await logsRes.json();
          (logsJson.data || []).forEach((log: { expense_id?: { id: number } | number }) => {
            const expId = typeof log.expense_id === "object" ? log.expense_id?.id : log.expense_id;
            if (expId) concernSet.add(Number(expId));
          });
        }
      } catch (e) {
        console.error("Failed to query expense_logs for concern flag in summary API:", e);
      }
    }

    const itemsWithConcernFlag = rawItems.map((item: { id: number }) => ({
      ...item,
      has_concern: concernSet.has(Number(item.id)),
    }));

    return NextResponse.json({ data: itemsWithConcernFlag });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
