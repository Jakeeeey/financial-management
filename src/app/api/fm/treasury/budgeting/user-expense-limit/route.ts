// src/app/api/user-expense-limit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = "vos_access_token";

// Local helper: fetch departments directly from Directus
async function fetchDepartments() {
  const res = await fetch(`${DIRECTUS_URL}/items/department?fields=department_id,department_name&limit=-1`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    cache: "no-store",
  });
  const json = await res.json();
  return json?.data ?? [];
}

// ─── User shape from /items/user ──────────────────────────────────────────────
interface DirectusUser {
  user_id:    number;
  user_fname: string | null;
  user_lname: string | null;
  user_email: string | null;
  user_department?: number | { department_id: number; department_name: string } | null;
}

function fullName(u: DirectusUser | undefined): string {
  if (!u) return "—";
  const name = [u.user_fname, u.user_lname].filter(Boolean).join(" ");
  return name || u.user_email || "—";
}

// ─── GET /api/user-expense-limit ──────────────────────────────────────────────
// ?action=available-users → users who don't have a limit yet
// (no action)             → all limits with joined user info
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "";

  // ── Users without a limit ────────────────────────────────────────────────
  if (action === "available-users") {
    try {
      const [existingRes, usersRes, depts] = await Promise.all([
        fetch(
          `${DIRECTUS_URL}/items/user_expense_ceiling?fields=user_id&limit=-1`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        ),
        fetch(
          `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1&sort=user_fname`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        ),
        fetchDepartments(),
      ]);

      const existingJson = await existingRes.json() as { data?: { user_id: number }[] };
      const usersJson    = await usersRes.json()    as { data?: DirectusUser[] };

      const takenIds = new Set((existingJson.data ?? []).map(r => r.user_id));
      const deptMap = Object.fromEntries((depts ?? []).map((d: { department_id: number; department_name: string }) => [d.department_id, d.department_name]));

      const available = (usersJson.data ?? [])
        .filter(u => !takenIds.has(u.user_id))
        .map(u => {
          let deptId: number | undefined;
          const d = (u as any).user_department;
          if (typeof d === "number") deptId = d;
          else if (d && typeof d === "object") deptId = Number(d.department_id ?? d.id ?? d);
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

  // ── All limits with joined user names ─────────────────────────────────────
  try {
    const [limitsRes, usersRes, depts] = await Promise.all([
      fetch(
        `${DIRECTUS_URL}/items/user_expense_ceiling?limit=-1&sort=-created_at`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetch(
        `${DIRECTUS_URL}/items/user?fields=user_id,user_fname,user_lname,user_email,user_department&limit=-1`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      ),
      fetchDepartments(),
    ]);

    const limitsJson = await limitsRes.json() as { data?: Record<string, unknown>[] };
    const usersJson  = await usersRes.json()  as { data?: DirectusUser[] };

    // Key by user_id (your custom users table uses user_id as PK)
    const userMap = Object.fromEntries(
      (usersJson.data ?? []).map(u => [u.user_id, u])
    );

    // Departments map
    const deptMap = Object.fromEntries(
      (depts ?? []).map((d: { department_id: number; department_name: string }) => [d.department_id, d.department_name])
    );

    const enriched = (limitsJson.data ?? []).map(l => {
      const userId = l.user_id   as number;
      const cbId   = l.created_by as number | null;
      const ubId   = l.updated_by as number | null;

      const u  = userMap[userId];
      const cb = cbId ? userMap[cbId] : undefined;
      const ub = ubId ? userMap[ubId] : undefined;
      let dept;
      const rawDept = (u as any)?.user_department;
      let deptId: number | undefined;
      if (typeof rawDept === "number") deptId = rawDept;
      else if (rawDept && typeof rawDept === "object") deptId = Number(rawDept.department_id ?? rawDept.id ?? rawDept);
      if (deptId) dept = deptMap[deptId];

      return {
        ...l,
        user_name:       fullName(u),
        user_email:      u?.user_email ?? null,
        user_department: dept ?? null,
        created_by_name: fullName(cb),
        updated_by_name: fullName(ub),
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error("[UEL GET]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}

// ─── Decode JWT payload to get current user_id ────────────────────────────────
// JWT is base64url encoded: header.payload.signature
// The payload contains sub (user_id as string) based on your token structure
function decodeJwtUserId(token: string): number | null {
  try {
    const parts   = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded  = payload + "=".repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
    // Your JWT has "sub" as the user_id string
    const sub = decoded.sub ?? decoded.user_id ?? decoded.userId ?? decoded.id;
    const id  = Number(sub);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

// ─── POST /api/user-expense-limit ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  // Decode the logged-in user's id from the JWT to store as created_by
  const currentUserId = decodeJwtUserId(token);

  try {
    const body = await request.json() as { user_id?: number; expense_limit?: number };
    const { user_id, expense_limit } = body;

    if (!user_id || !expense_limit) {
      return NextResponse.json(
        { ok: false, message: "user_id and expense_limit are required." },
        { status: 400 }
      );
    }

    const res  = await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        user_id,
        expense_limit,
        created_by: currentUserId,  // ← logged-in user from JWT
      }),
      cache:   "no-store",
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to create.";
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json(
      { ok: true, data: json.data, message: "Expense limit created successfully." },
      { status: 201 }
    );
  } catch (err) {
    console.error("[UEL POST]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}