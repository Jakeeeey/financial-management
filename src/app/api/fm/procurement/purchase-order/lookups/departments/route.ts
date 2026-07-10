import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/department?limit=-1&fields=department_id,department_name&sort=department_name`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ data: json.data || [] });
  } catch (err) {
    return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : "Unknown" }, { status: 502 });
  }
}
