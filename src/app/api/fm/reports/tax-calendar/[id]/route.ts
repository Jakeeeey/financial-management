// src/app/api/fm/reports/tax-calendar/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = 'vos_access_token';



// ─── PATCH /api/fm/reports/tax-calendar/[id] ──────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' }, 
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json() as Record<string, unknown>;
    const { title, description, tax_type, due_date, status, reminder_date, bir_form, filing_frequency, due_date_rule, actual_filing_date, payment_date, amount_paid } = body;

    // All fields optional for PATCH
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (tax_type !== undefined) updateData.tax_type = tax_type;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (status !== undefined) updateData.status = status;
    if (reminder_date !== undefined) updateData.reminder_date = reminder_date || null;
    if (bir_form !== undefined) updateData.bir_form = bir_form || null;
    if (filing_frequency !== undefined) updateData.filing_frequency = filing_frequency || null;
    if (due_date_rule !== undefined) updateData.due_date_rule = due_date_rule || null;
    if (actual_filing_date !== undefined) updateData.actual_filing_date = actual_filing_date || null;
    if (payment_date !== undefined) updateData.payment_date = payment_date || null;
    if (amount_paid !== undefined) updateData.amount_paid = amount_paid ? Number(amount_paid) : null;

    const res = await fetch(`${DIRECTUS_URL}/items/tax_activities/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify(updateData),
      cache:   'no-store',
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : 'Failed to update';
      console.error('[TAX-CAL PATCH] Directus error:', msg);
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json(json);
  } catch (err) {
    console.error('[TAX-CAL PATCH]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: 'Gateway Error' }, { status: 502 });
  }
}