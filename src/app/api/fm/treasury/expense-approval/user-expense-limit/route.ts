// src/app/api/fm/treasury/budgeting/user-expense-limit/route.ts

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

type RawDepartmentField =
  | number
  | { department_id?: number; id?: number }
  | null
  | undefined;

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
    const n  = Number(id);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "";

  // ── Departments list ──────────────────────────────────────────────────────
  if (action === "departments") {
    try {
      const depts = await fetchDepartments();
      return NextResponse.json({ data: depts });
    } catch (err) {
      console.error("[UEL Departments]", err instanceof Error ? err.message : String(err));
      return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
    }
  }

  // ── Users without a limit ────────────────────────────────────────────────
  if (action === "available-users") {
    try {
      const [existingRes, pendingRes, usersRes, depts] = await Promise.all([
        fetch(
          `${DIRECTUS_URL}/items/user_expense_ceiling?fields=user_id&limit=-1`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        ),
        fetch(
          `${DIRECTUS_URL}/items/user_expense_ceiling_request?filter[status][_eq]=Pending&fields=user_id&limit=-1`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        ),
        fetch(
          `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1&sort=user_fname`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        ),
        fetchDepartments(),
      ]);

      const existingJson = await existingRes.json() as { data?: { user_id: number }[] };
      const pendingJson  = await pendingRes.json()  as { data?: { user_id: number }[] };
      const usersJson    = await usersRes.json()    as { data?: DirectusUser[] };

      const takenIds = new Set([
        ...(existingJson.data ?? []).map(r => r.user_id),
        ...(pendingJson.data ?? []).map(r => r.user_id)
      ]);
      const deptMap  = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));

      const available = (usersJson.data ?? [])
        .filter(u => !takenIds.has(u.user_id))
        .map(u => {
          const deptId = parseDeptId(u.user_department);
          return {
            ...u,
            user_department_name: deptId ? (deptMap[deptId] ?? null) : null,
          };
        });

      return NextResponse.json({ data: available });
    } catch (err) {
      console.error("[UEL Available Users]", err instanceof Error ? err.message : String(err));
      return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
    }
  }

  // ── Chart of Accounts list ────────────────────────────────────────────────
  if (action === "coas") {
    try {
      const res = await fetch(`${DIRECTUS_URL}/items/chart_of_accounts?fields=coa_id,account_title,gl_code&limit=-1&sort=account_title`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      });
      const json = await res.json() as { data?: any[] };
      return NextResponse.json({ data: json.data ?? [] });
    } catch (err) {
      console.error("[UEL COAs]", err instanceof Error ? err.message : String(err));
      return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
    }
  }

  // ── All limits grouped by user_id ─────────────────────────────────────────
  try {
    const department_id = searchParams.get("department_id");

    const [limitsRes, usersRes, depts, requestsRes] = await Promise.all([
      fetch(
        `${DIRECTUS_URL}/items/user_expense_ceiling?limit=-1&sort=-created_at`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetch(
        `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetchDepartments(),
      fetch(
        `${DIRECTUS_URL}/items/user_expense_ceiling_request?filter[status][_eq]=Pending&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
    ]);

    const limitsJson = await limitsRes.json() as { data?: Record<string, any>[] };
    const usersJson  = await usersRes.json()  as { data?: DirectusUser[] };
    const requestsJson = await requestsRes.json() as { data?: Record<string, any>[] };

    const userMap = Object.fromEntries(
      (usersJson.data ?? []).map(u => [u.user_id, u])
    );
    const deptMap = Object.fromEntries(
      depts.map(d => [d.department_id, d.department_name])
    );

    const allUserIds = new Set([
      ...(limitsJson.data ?? []).map(l => l.user_id),
      ...(requestsJson.data ?? []).map(r => r.user_id)
    ]);

    const enriched = Array.from(allUserIds).map(userId => {
      const userActiveRows = (limitsJson.data ?? []).filter(l => l.user_id === userId);
      const limits: Record<number, string> = {};
      let activeCreatedBy: number | null = null;
      let activeUpdatedBy: number | null = null;
      let activeCreatedAt: string = "";
      let activeUpdatedAt: string = "";

      userActiveRows.forEach(l => {
        const coaId = l.coa_id || 0;
        limits[coaId] = l.expense_limit;
        if (!activeCreatedAt || new Date(l.created_at) < new Date(activeCreatedAt)) {
          activeCreatedAt = l.created_at;
          activeCreatedBy = l.created_by;
        }
        if (!activeUpdatedAt || new Date(l.updated_at || l.created_at) > new Date(activeUpdatedAt)) {
          activeUpdatedAt = l.updated_at || l.created_at;
          activeUpdatedBy = l.updated_by;
        }
      });

      const userPendingRows = (requestsJson.data ?? []).filter(r => r.user_id === userId);
      const pending_limits: Record<number, string> = {};
      let hasPending = userPendingRows.length > 0;
      userPendingRows.forEach(r => {
        const coaId = r.coa_id || 0;
        pending_limits[coaId] = r.expense_limit;
      });

      const u = userMap[userId];
      const cb = activeCreatedBy ? userMap[activeCreatedBy] : undefined;
      const ub = activeUpdatedBy ? userMap[activeUpdatedBy] : undefined;
      const deptId = parseDeptId(u?.user_department);
      const dept = deptId ? deptMap[deptId] : undefined;

      return {
        id: userId,
        user_id: userId,
        user_name: fullName(u),
        user_email: u?.user_email ?? null,
        user_department: dept ?? null,
        user_department_id: deptId ?? null,
        limits: Object.keys(limits).length > 0 ? limits : null,
        pending_limits: hasPending ? pending_limits : null,
        created_by_name: cb ? fullName(cb) : "—",
        updated_by_name: ub ? fullName(ub) : "—",
        created_at: activeCreatedAt || null,
        updated_at: activeUpdatedAt || null
      };
    });

    const filtered = department_id
      ? enriched.filter(item => item.user_department_id === Number(department_id))
      : enriched;

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("[UEL GET]", err instanceof Error ? err.message : String(err));
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

// ─── POST /api/user-expense-limit (Submits changes as Draft/Pending) ──────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const currentUserId = decodeJwtUserId(token);

  try {
    const body = await request.json() as { user_id?: number; limits?: Record<number, number>; remarks?: string };
    const { user_id, limits, remarks } = body;

    if (!user_id || !limits) {
      return NextResponse.json(
        { ok: false, message: "user_id and limits are required." },
        { status: 400 }
      );
    }

    // 1. Delete any existing "Pending" requests for this user to avoid duplicate proposals
    const existingPendingRes = await fetch(
      `${DIRECTUS_URL}/items/user_expense_ceiling_request?filter[user_id][_eq]=${user_id}&filter[status][_eq]=Pending&fields=id&limit=-1`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    const existingPending = await existingPendingRes.json() as { data?: { id: number }[] };
    const deleteIds = (existingPending.data ?? []).map(r => r.id);

    if (deleteIds.length > 0) {
      await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling_request`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        body: JSON.stringify(deleteIds)
      });
    }

    // 2. Prepare request payloads for each selected COA limit
    const insertPayloads = Object.entries(limits).map(([coaId, amount]) => ({
      user_id: Number(user_id),
      coa_id: Number(coaId),
      expense_limit: Number(amount),
      status: "Pending",
      remarks: remarks || "",
      created_by: currentUserId,
      created_at: new Date().toISOString()
    }));

    const createRes = await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling_request`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify(insertPayloads),
      cache:   "no-store",
    });

    const json = await createRes.json() as Record<string, unknown>;
    if (!createRes.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to create proposal.";
      return NextResponse.json({ ok: false, message: msg }, { status: createRes.status });
    }

    return NextResponse.json(
      { ok: true, message: "Expense limit proposal submitted successfully for approval." },
      { status: 201 }
    );
  } catch (err) {
    console.error("[UEL POST]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}