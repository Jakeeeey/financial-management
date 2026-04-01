// src/app/api/fm/reports/tax-calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = 'vos_access_token';

// ─── GET /api/fm/reports/tax-calendar ─────────────────────────────────────────
// Prefix with _ to signal intentionally unused (satisfies @typescript-eslint/no-unused-vars)
// Prefix with _ to signal intentionally unused (satisfies @typescript-eslint/no-unused-vars)
export async function GET() {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/tax_activities?limit=-1&sort=-due_date`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: 'no-store' }
    );

    const json = await res.json() as { data?: Record<string, unknown>[] };

    if (!res.ok) {
      const msg = (json as Record<string, unknown>)?.message ?? 'Failed to fetch';
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json({ data: json.data ?? [] });
  } catch (err) {
    console.error('[TAX-CAL GET]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Gateway Error' }, { status: 502 });
  }
}

// ─── POST /api/fm/reports/tax-calendar ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { title?: string; description?: string; tax_type?: string; due_date?: string; status?: string; reminder_date?: string };
    const { title, description, tax_type, due_date, status, reminder_date } = body;

    if (!title || !tax_type || !due_date) {
      return NextResponse.json({ ok: false, message: 'Missing required fields: title, tax_type, due_date' }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/tax_activities`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        id: randomUUID(),
        title,
        description: description || null,
        tax_type,
        due_date,
        status: status ?? 'PENDING',
        reminder_date: reminder_date || null,
      }),
      cache: 'no-store',
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : 'Failed to create';
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json(json, { status: 201 });
  } catch (err) {
    console.error('[TAX-CAL POST]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Gateway Error' }, { status: 502 });
  }
}