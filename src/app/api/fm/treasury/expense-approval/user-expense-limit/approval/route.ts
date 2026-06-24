// src/app/api/fm/treasury/budgeting/user-expense-limit/approval/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = "vos_access_token";

interface Department {
  department_id:   number;
  department_name: string;
}

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${DIRECTUS_URL}/items/department?fields=department_id,department_name&limit=-1`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    cache: "no-store",
  });
  const json = await res.json();
  return json?.data ?? [];
}

type RawDepartmentField = number | { department_id?: number; id?: number } | null | undefined;
interface DirectusUser {
  user_id:         number;
  user_fname:      string | null;
  user_lname:      string | null;
  user_email:      string | null;
  user_department: RawDepartmentField;
}

function fullName(u: DirectusUser | undefined): string {
  if (!u) return "—";
  const name = [u.user_fname, u.user_lname].filter(Boolean).join(" ");
  return name || u.user_email || "—";
}

function parseDeptId(raw: RawDepartmentField): number | undefined {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    const id = raw.department_id ?? raw.id;
    const n = Number(id);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  try {
    const [requestsRes, usersRes, depts] = await Promise.all([
      fetch(
        `${DIRECTUS_URL}/items/user_expense_ceiling_request?filter[status][_eq]=Pending&limit=-1&sort=-created_at`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetch(
        `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetchDepartments(),
    ]);

    const requestsJson = await requestsRes.json() as { data?: Record<string, any>[] };
    const usersJson    = await usersRes.json() as { data?: DirectusUser[] };

    const userMap = Object.fromEntries((usersJson.data ?? []).map(u => [u.user_id, u]));
    const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));

    // Group pending requests by user_id
    const userRequests: Record<number, { 
      user_id: number; 
      limits: Record<number, string>; 
      remarks: string;
      created_at: string;
      created_by: number | null;
    }> = {};

    for (const r of (requestsJson.data ?? [])) {
      const userId = r.user_id;
      const coaId = r.coa_id || 0;
      if (!userRequests[userId]) {
        userRequests[userId] = {
          user_id: userId,
          limits: {},
          remarks: r.remarks || "",
          created_at: r.created_at,
          created_by: r.created_by
        };
      }
      userRequests[userId].limits[coaId] = r.expense_limit;
    }

    const enriched = Object.values(userRequests).map(ur => {
      const u = userMap[ur.user_id];
      const cb = ur.created_by ? userMap[ur.created_by] : undefined;
      const deptId = parseDeptId(u?.user_department);

      return {
        id: ur.user_id,
        user_id: ur.user_id,
        user_name: fullName(u),
        user_email: u?.user_email ?? null,
        user_department: deptId ? (deptMap[deptId] ?? null) : null,
        user_department_id: deptId ?? null,
        limits: ur.limits,
        remarks: ur.remarks,
        created_by_name: cb ? fullName(cb) : "—",
        created_at: ur.created_at
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error("[UEL Approval GET]", err);
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}

function decodeJwtUserId(token: string): number | null {
  try {
    const parts   = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded  = payload + "=".repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
    const sub = decoded.sub ?? decoded.user_id ?? decoded.userId ?? decoded.id;
    const id  = Number(sub);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const currentUserId = decodeJwtUserId(token);

  try {
    const body = await request.json() as { user_id?: number; action?: "approve" | "reject"; limits?: Record<number, number>; remarks?: string };
    const { user_id, action, limits, remarks } = body;

    if (!user_id || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, message: "user_id, action (approve/reject) are required." }, { status: 400 });
    }

    // 1. Fetch the pending request rows for this user
    const pendingRes = await fetch(
      `${DIRECTUS_URL}/items/user_expense_ceiling_request?filter[user_id][_eq]=${user_id}&filter[status][_eq]=Pending&limit=-1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    const pendingJson = await pendingRes.json() as { data?: Record<string, any>[] };
    const pendingRows = pendingJson.data || [];

    if (pendingRows.length === 0) {
      return NextResponse.json({ ok: false, message: "No pending requests found for this user." }, { status: 404 });
    }

    const finalStatus = action === "approve" ? "Approved" : "Rejected";

    // 2. Update status of the draft records in user_expense_ceiling_request
    const updatePayloads = pendingRows.map(r => {
      const proposedLimit = (limits && limits[r.coa_id] !== undefined) ? Number(limits[r.coa_id]) : Number(r.expense_limit);
      return {
        id: r.id,
        status: finalStatus,
        expense_limit: proposedLimit,
        updated_by: currentUserId,
        updated_at: new Date().toISOString()
      };
    });

    const updateRequestRes = await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling_request`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: JSON.stringify(updatePayloads),
      cache: "no-store"
    });

    if (!updateRequestRes.ok) {
      const json = await updateRequestRes.json() as Record<string, any>;
      return NextResponse.json({ ok: false, message: json?.errors?.[0]?.message || "Failed to update request status." }, { status: updateRequestRes.status });
    }

    // 3. If action is approve, copy or upsert the limits into user_expense_ceiling
    if (action === "approve") {
      const existingCeilingsRes = await fetch(
        `${DIRECTUS_URL}/items/user_expense_ceiling?filter[user_id][_eq]=${user_id}&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      );
      const existingCeilingsJson = await existingCeilingsRes.json() as { data?: Record<string, any>[] };
      const existingCeilings = existingCeilingsJson.data || [];
      const existingMap = Object.fromEntries(existingCeilings.map(c => [c.coa_id || 0, c.id]));

      const upsertPayloads = pendingRows.map(r => {
        const proposedLimit = (limits && limits[r.coa_id] !== undefined) ? Number(limits[r.coa_id]) : Number(r.expense_limit);
        const coaId = r.coa_id || 0;
        const existingId = existingMap[coaId];

        if (existingId) {
          return {
            id: existingId,
            expense_limit: proposedLimit,
            updated_by: currentUserId,
            updated_at: new Date().toISOString()
          };
        } else {
          return {
            user_id: Number(user_id),
            coa_id: Number(coaId),
            expense_limit: proposedLimit,
            created_by: currentUserId,
            created_at: new Date().toISOString()
          };
        }
      });

      const updates = upsertPayloads.filter(p => p.id !== undefined);
      const inserts = upsertPayloads.filter(p => p.id === undefined);

      if (updates.length > 0) {
        await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify(updates),
          cache: "no-store"
        });
      }

      if (inserts.length > 0) {
        await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify(inserts),
          cache: "no-store"
        });
      }
    }

    return NextResponse.json({ ok: true, message: `Limit request ${action}d successfully.` });
  } catch (err) {
    console.error("[UEL Approval POST]", err);
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}
