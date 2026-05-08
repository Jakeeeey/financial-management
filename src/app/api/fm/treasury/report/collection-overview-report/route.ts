import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'vos_access_token';


export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  const authHeader = request.headers.get("Authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const token = cookieToken || headerToken;

  if (!token) {
    console.warn('[CollectionOverviewReport] No token found in cookie or Authorization header');
    return NextResponse.json(
      { ok: false, message: 'Unauthorized: Missing access token' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const salesman = searchParams.get('salesman');
  const type     = searchParams.get('type');
  const isPosted = searchParams.get('isPosted');
  const paymentMethod = searchParams.get('paymentMethod');

  const query = new URLSearchParams();
  query.set('startDate', startDate);
  query.set('endDate', endDate);
  if (salesman) query.set('salesman', salesman);
  if (type)     query.set('type', type);
  if (isPosted) query.set('isPosted', isPosted);
  if (paymentMethod) query.set('paymentMethod', paymentMethod);

  const base = (process.env.SPRING_API_BASE_URL || '').replace(/\/$/, '');

  if (!base) {
    console.error('[CollectionOverviewReport] SPRING_API_BASE_URL is not set');
    return NextResponse.json({ ok: false, error: 'Server misconfiguration' }, { status: 500 });
  }

  const targetUrl = `${base}/api/view-collection-report?${query.toString()}`;

  try {
    console.log('[CollectionOverviewReport] Fetching:', targetUrl);
    const springRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    if (!springRes.ok) {
      const text = await springRes.text();
      console.error('[CollectionOverviewReport] Upstream error:', springRes.status, text.slice(0, 200));
      return NextResponse.json({ ok: false, status: springRes.status }, { status: springRes.status });
    }

    const data = await springRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorString = err instanceof Error ? err.message : String(err);
    console.error('[CollectionOverviewReport]', errorString);
    return NextResponse.json({ ok: false, error: 'Gateway Error', details: errorString }, { status: 502 });
  }
}
