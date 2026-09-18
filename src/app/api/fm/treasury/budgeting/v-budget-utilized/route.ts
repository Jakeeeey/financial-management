import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    console.warn("[VBudgetUtilizedProxy] Unauthorized: Missing access token in cookies");
    return NextResponse.json(
      { ok: false, message: "Unauthorized: Missing access token" },
      { status: 401 }
    );
  }

  const base = SPRING_API_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    console.error("[VBudgetUtilizedProxy] SPRING_API_BASE_URL is not configured in .env.local");
    return NextResponse.json(
      { ok: false, message: "SPRING_API_BASE_URL is not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get("divisionId");
  const departmentId = searchParams.get("departmentId");
  const coaId = searchParams.get("coaId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const query = new URLSearchParams();
  if (divisionId) query.set("divisionId", divisionId);
  if (departmentId) query.set("departmentId", departmentId);
  if (coaId) query.set("coaId", coaId);
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const targetUrl = `${base}/api/v-budget-utilized/filter${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  console.log(`[VBudgetUtilizedProxy] Forwarding request to: ${targetUrl}`);

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");
      console.error(`[VBudgetUtilizedProxy] Upstream error ${upstream.status} ${upstream.statusText}:`, errorText);
      return NextResponse.json(
        { ok: false, status: upstream.status, message: "Upstream request failed.", error: errorText },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("[VBudgetUtilizedProxy] Gateway Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, message: "Gateway Error" },
      { status: 502 }
    );
  }
}

