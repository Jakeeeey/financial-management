// src/app/api/user-expense-limit/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = "vos_access_token";

// ─── Decode JWT payload to get current user_id ────────────────────────────────
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

// ─── PATCH /api/user-expense-limit/[id] ──────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore   = await cookies();
  const token         = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const { id }        = await params;
  const currentUserId = decodeJwtUserId(token);

  try {
    const body = await request.json() as { expense_limit?: number };
    const { expense_limit } = body;

    if (!expense_limit) {
      return NextResponse.json({ ok: false, message: "expense_limit is required." }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/user_expense_ceiling/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        expense_limit,
        updated_by: currentUserId,  // ← logged-in user from JWT
      }),
      cache: "no-store",
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to update.";
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json({ ok: true, data: json.data, message: "Expense limit updated successfully." });
  } catch (err) {
    console.error("[UEL PATCH]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}