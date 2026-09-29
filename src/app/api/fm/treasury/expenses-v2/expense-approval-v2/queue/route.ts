import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwtDecode(token) as { sub?: string };
    return decoded.sub ? parseInt(decoded.sub, 10) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ data: [] });
    }

    // 1. Fetch active division assignments for current logged-in approver
    const approverRes = await fetch(
      `${API_BASE_URL}/items/expense_approvers?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=false&fields=division_id`,
      {
        headers: AUTH_HEADERS,
        cache: "no-store",
      }
    );

    if (!approverRes.ok) {
      return NextResponse.json({ data: [] });
    }

    const approverJson = await approverRes.json();
    const records = approverJson.data || [];

    if (records.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Extract division IDs assigned to this approver
    const assignedDivisionIds = records
      .map((r: { division_id?: { division_id: number } | number }) => (typeof r.division_id === "object" ? r.division_id?.division_id : r.division_id))
      .filter((id: number | undefined | null) => id !== null && id !== undefined);

    if (assignedDivisionIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 2. Fetch expenses belonging to assigned divisions with status = Pending Approval
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
      "created_at",
      "created_by.user_id",
      "created_by.user_fname",
      "created_by.user_lname",
      "created_by.user_email",
    ].join(",");

    const divisionIdsParam = assignedDivisionIds.join(",");
    const filterUrl = `${API_BASE_URL}/items/expense?fields=${fields}&filter[is_deleted][_eq]=false&filter[status][_eq]=Pending Approval&filter[division_id][_in]=${divisionIdsParam}&sort=-created_at`;

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

    // 3. Query expense_logs to check if any of these expenses have action == 'With Concern'
    const pendingIds = rawItems.map((item: { id?: number }) => item.id).filter(Boolean);
    const concernSet = new Set<number>();

    if (pendingIds.length > 0) {
      try {
        const logsUrl = `${API_BASE_URL}/items/expense_logs?filter[expense_id][_in]=${pendingIds.join(",")}&filter[action][_eq]=With Concern&fields=expense_id&limit=-1`;
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
        console.error("Failed to query expense_logs for concern flag:", e);
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
