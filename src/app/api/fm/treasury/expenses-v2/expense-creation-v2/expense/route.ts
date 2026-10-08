import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";

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

async function createExpenseLog(logData: {
  expense_id: number;
  action: string;
  remarks?: string | null;
  receipt_url?: string | null;
  created_by?: number | null;
}) {
  try {
    await fetch(`${API_BASE_URL}/items/expense_logs`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(logData),
    });
  } catch (e) {
    console.error("Expense Log Creation Error:", e);
  }
}

async function generateSequentialDocNo(count: number = 1): Promise<string[]> {
  const currentYear = new Date().getFullYear();
  const prefix = `EXP-${currentYear}-`;

  try {
    const res = await fetch(
      `${API_BASE_URL}/items/expense?filter[doc_no][_starts_with]=${prefix}&fields=doc_no&limit=-1`,
      {
        headers: AUTH_HEADERS,
        cache: "no-store",
      }
    );

    let maxSeq = 0;
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data.data) ? data.data : [];
      const regex = new RegExp(`^EXP-${currentYear}-(\\d+)$`);
      for (const item of items) {
        const docNoStr = String(item.doc_no || "").trim();
        const match = docNoStr.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }

    const docNos: string[] = [];
    for (let i = 0; i < count; i++) {
      const nextSeq = maxSeq + 1 + i;
      docNos.push(`${prefix}${String(nextSeq).padStart(6, "0")}`);
    }
    return docNos;
  } catch (err) {
    console.error("Error generating sequential doc_no:", err);
    const docNos: string[] = [];
    const baseOffset = Math.floor(Date.now() % 800000);
    for (let i = 0; i < count; i++) {
      const seq = String(baseOffset + i + 1).padStart(6, "0");
      docNos.push(`${prefix}${seq}`);
    }
    return docNos;
  }
}

// GET: Fetch expense list for current logged-in user with soft-delete filter
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = new URLSearchParams(searchParams);
  const userId = await getUserId();

  if (!query.has("filter[is_deleted][_eq]")) {
    query.append("filter[is_deleted][_eq]", "0");
  }

  if (userId && !query.has("filter[created_by][_eq]")) {
    query.append("filter[created_by][_eq]", String(userId));
  }

  if (!query.has("sort")) {
    query.append("sort", "-id");
  }

  const targetUrl = `${API_BASE_URL}/items/expense?${query.toString()}`;

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: AUTH_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET Expense Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

// POST: Create single or bulk expenses
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = await getUserId();

    const isBulk = Array.isArray(body);

    if (isBulk) {
      const generatedDocNos = await generateSequentialDocNo(body.length);
      const itemsWithDocNo = body.map((item: Record<string, unknown>, idx: number) => ({
        ...item,
        is_employee: item.is_employee ? 1 : 0,
        doc_no: item.doc_no || generatedDocNos[idx],
        created_by: userId || item.created_by || null,
        current_approval_level: item.status === "Pending Approval" ? 1 : 0,
      }));

      const res = await fetch(`${API_BASE_URL}/items/expense`, {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify(itemsWithDocNo),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Directus Error" }));
        return NextResponse.json(error, { status: res.status });
      }

      const result = await res.json();
      const createdItems = Array.isArray(result.data) ? result.data : [result.data];

      for (let i = 0; i < createdItems.length; i++) {
        const item = createdItems[i];
        if (item?.id) {
          const action = item.status === "Pending Approval" ? "Pending Approval" : "Draft";
          await createExpenseLog({
            expense_id: item.id,
            action: action,
            remarks: item.remarks || `Created via bulk entry (Batch item ${i + 1} of ${createdItems.length})`,
            receipt_url: item.receipt_url || null,
            created_by: userId,
          });
        }
      }

      return NextResponse.json(result);
    } else {
      const generatedDocNos = await generateSequentialDocNo(1);
      const payload = {
        ...body,
        is_employee: body.is_employee ? 1 : 0,
        doc_no: body.doc_no || generatedDocNos[0],
        created_by: userId || body.created_by || null,
        current_approval_level: body.status === "Pending Approval" ? 1 : 0,
      };

      const res = await fetch(`${API_BASE_URL}/items/expense`, {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Directus Error" }));
        return NextResponse.json(error, { status: res.status });
      }

      const result = await res.json();
      const created = result.data;

      if (created?.id) {
        const action = created.status === "Pending Approval" ? "Pending Approval" : "Draft";
        await createExpenseLog({
          expense_id: created.id,
          action: action,
          remarks: created.remarks || "Created single expense",
          receipt_url: created.receipt_url || null,
          created_by: userId,
        });
      }

      return NextResponse.json(result);
    }
  } catch (err) {
    console.error("POST Expense Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

// PATCH: Update/Resubmit expense
export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = await getUserId();

  if (!id) {
    return NextResponse.json({ message: "Expense ID is required for update" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // Extract non-DB audit parameters before sending payload to Directus
    const { is_resubmit, log_remarks, ...directusPayload } = body;

    if (directusPayload.is_employee !== undefined) {
      directusPayload.is_employee = directusPayload.is_employee ? 1 : 0;
    }

    // Fetch current expense record for data integrity validation and audit logging
    let currentExpense: Record<string, unknown> | null = null;
    const getRes = await fetch(`${API_BASE_URL}/items/expense/${id}`, {
      headers: AUTH_HEADERS,
      cache: "no-store",
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      currentExpense = getJson.data || null;
    }

    // Server-side guard: Verify mandatory fields if status is transitioning to Pending Approval
    if (directusPayload.status === "Pending Approval" && currentExpense) {
      const merged = { ...currentExpense, ...directusPayload };
      if (
        !merged.expense_date ||
        !merged.payee ||
        !merged.division_id ||
        !merged.department_id ||
        !merged.coa_id ||
        !merged.amount ||
        Number(merged.amount) <= 0 ||
        !merged.receipt_url
      ) {
        return NextResponse.json(
          {
            message:
              "Cannot submit for approval: Missing mandatory fields (Date, Payee, Division, Department, COA, Amount, or Receipt Image)",
          },
          { status: 400 }
        );
      }
    }

    const res = await fetch(`${API_BASE_URL}/items/expense/${id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify(directusPayload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const result = await res.json();
    const updated = result.data;

    // Log action based on payload flag or status change
    let logAction = "Draft";
    if (is_resubmit) {
      logAction = "Resubmitted";
    } else if (updated?.status === "Pending Approval") {
      logAction = "Pending Approval";
    } else if (updated?.status === "Draft") {
      logAction = "Draft";
    }

    if (updated?.id) {
      // Prioritize explicit log_remarks (e.g., from resubmission note/explanation for approver) over general expense description
      const resolvedRemarks =
        (typeof log_remarks === "string" && log_remarks.trim() ? log_remarks.trim() : null) ||
        (is_resubmit ? "Resubmitted expense with updates" : null) ||
        updated.remarks ||
        body.remarks ||
        (currentExpense?.remarks as string | null) ||
        null;

      await createExpenseLog({
        expense_id: updated.id,
        action: logAction,
        remarks: resolvedRemarks,
        receipt_url: updated.receipt_url || body.receipt_url || (currentExpense?.receipt_url as string | null) || null,
        created_by: userId,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH Expense Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

// DELETE: Soft delete expense
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = await getUserId();

  if (!id) {
    return NextResponse.json({ message: "Expense ID is required for delete" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/items/expense/${id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        is_deleted: 1,
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE Expense Error:", err);
    return NextResponse.json(
      { message: "BFF Error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
