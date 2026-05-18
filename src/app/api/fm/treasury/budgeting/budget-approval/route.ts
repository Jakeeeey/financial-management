import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

// Helper to get user ID from JWT cookie
async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwtDecode(token) as { sub?: string };
    return decoded.sub ? parseInt(decoded.sub) : null;
  } catch (e) {
    console.error("JWT Decode Error:", e);
    return null;
  }
}

// Helper to create audit log
async function createAuditLog(log: {
  budget_id: number;
  action: string;
  previous_status?: string | null;
  new_status: string;
  previous_amount?: number | null;
  new_amount: number;
  remarks?: string | null;
  performed_by: number | null;
}): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/items/budget_audit_trail`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(log),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data?.id || null;
    }
    return null;
  } catch (e) {
    console.error("Audit Log Insertion Error:", e);
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const collection = searchParams.get("collection");
  
  // Create a clean query string for Directus
  const query = new URLSearchParams(searchParams);
  query.delete("collection");

  let targetUrl = "";
  if (collection === "division") {
    targetUrl = `${API_BASE_URL}/items/division?${query.toString()}`;
  } else if (collection === "department_per_division") {
    targetUrl = `${API_BASE_URL}/items/department_per_division?${query.toString()}`;
  } else if (collection === "budget_attachments") {
    targetUrl = `${API_BASE_URL}/items/budget_attachments?${query.toString()}`;
  } else {
    // Default to budget fetching for approval
    if (!query.has("filter[status][_neq]")) {
      query.append("filter[status][_neq]", "Deleted");
    }
    targetUrl = `${API_BASE_URL}/items/budget?${query.toString()}`;
  }

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
    console.error("GET Budget Approval Proxy Error:", err);
    return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const userId = await getUserId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  try {
    const body = await req.json();
    const isBulk = !!(body.keys && body.data);
    const idsToUpdate = isBulk ? body.keys : (id ? [id] : []);
    
    if (idsToUpdate.length === 0) {
      return NextResponse.json({ message: "No IDs provided for update" }, { status: 400 });
    }

    // 1. Fetch current status/amount for audit trail before updating
    const filter = `filter[id][_in]=${idsToUpdate.join(",")}`;
    const oldRes = await fetch(`${API_BASE_URL}/items/budget?${filter}&fields=id,status,amount`, {
      headers: AUTH_HEADERS
    });
    
    const oldDataMap: Record<string, { status?: string; amount?: number | string }> = {};
    if (oldRes.ok) {
      const oldResult = await oldRes.json();
      const list = Array.isArray(oldResult.data) ? oldResult.data : [oldResult.data];
      list.forEach((item: { id?: string | number; status?: string; amount?: number | string }) => { if (item) oldDataMap[String(item.id)] = item; });
    }

    // 2. PRE-LOGGING (Strict Flow): Create audit logs FIRST
    const createdLogIds: number[] = [];
    const newStatus = isBulk ? body.data.status : body.status;
    const remarks = isBulk ? (body.data.remarks || body.remarks) : body.remarks;
    const action = isBulk ? (body.data.action || body.action) : body.action;

    for (const bId of idsToUpdate) {
      const oldItem = oldDataMap[String(bId)];
      // Strictly enforce DDL ENUM allowed values
      let finalAction = action || (newStatus === "Approved" ? "Approved" : newStatus === "Rejected" ? "Rejected" : "Submitted");
      if (!['Created','Submitted','Approved','Rejected','Resubmitted','Supplement Requested','Deleted'].includes(finalAction)) {
        finalAction = newStatus === "Approved" ? "Approved" : newStatus === "Rejected" ? "Rejected" : "Submitted";
      }

      const logId = await createAuditLog({
        budget_id: Number(bId),
        action: finalAction,
        previous_status: oldItem?.status || null,
        new_status: newStatus,
        previous_amount: oldItem ? Number(oldItem.amount) : null,
        new_amount: oldItem ? Number(oldItem.amount) : 0,
        remarks: remarks || null,
        performed_by: userId,
      });
      if (logId) createdLogIds.push(logId);
    }

    // 3. Perform the update
    let targetUrl = `${API_BASE_URL}/items/budget`;
    if (!isBulk && id) targetUrl += `/${id}`;

    const payload = isBulk ? {
      keys: body.keys,
      data: { ...body.data, updated_by: userId }
    } : {
      ...body, updated_by: userId
    };

    const res = await fetch(targetUrl, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // ROLLBACK STRATEGY: Delete pre-created audit logs to keep database synchronized
      if (createdLogIds.length > 0) {
        try {
          await fetch(`${API_BASE_URL}/items/budget_audit_trail`, {
            method: "DELETE",
            headers: AUTH_HEADERS,
            body: JSON.stringify(createdLogIds),
          });
        } catch (rollbackErr) {
          console.error("Rollback failed to delete orphaned audit logs:", rollbackErr);
        }
      }
      const error = await res.json().catch(() => ({ message: "Directus Error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error("PATCH Budget Approval Proxy Error:", err);
    return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
