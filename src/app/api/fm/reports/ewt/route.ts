import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = 'vos_access_token';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized: Missing access token' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');

  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate)   query.set('endDate', endDate);

  const base      = SPRING_API_BASE_URL?.replace(/\/$/, '');
  const targetUrl = `${base}/api/view-fm-reports-ewt/all${query.toString() ? `?${query}` : ''}`;

  try {
    const springRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!springRes.ok) {
      console.error('[EWT] Upstream error:', springRes.status, springRes.statusText);
      return NextResponse.json({ ok: false, status: springRes.status }, { status: springRes.status });
    }

    const data = await springRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[EWT] Request failed:', err.message);
    return NextResponse.json({ ok: false, error: 'Gateway Error' }, { status: 502 });
  }
}