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
    const itemTmplId = searchParams.get("item_tmpl_id");

    const filter: Record<string, unknown> = {};
    if (itemTmplId) {
      filter.item_tmpl_id = { _eq: Number(itemTmplId) };
    }

    const params = new URLSearchParams({
      limit: "100",
      sort: "name",
      fields: "id,item_tmpl_id,name,list_price",
    });
    if (Object.keys(filter).length > 0) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(
      `${DIRECTUS_URL}/items/item_variant?${params.toString()}`,
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
