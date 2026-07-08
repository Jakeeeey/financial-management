import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vos_access_token")?.value ?? null;
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    const filter: Record<string, unknown> = {};
    if (q) {
      filter._or = [
        { supplier_name: { _contains: q } },
        { email_address: { _contains: q } },
      ];
    }

    const params = new URLSearchParams({
      limit: "20",
      sort: "supplier_name",
      fields: "id,supplier_name,email_address,phone_number,address,supplier_type,tin_number,payment_terms",
    });
    if (Object.keys(filter).length > 0) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(
      `${DIRECTUS_URL}/items/suppliers?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
