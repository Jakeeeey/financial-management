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
      `${DIRECTUS_URL}/items/user?limit=-1&fields=user_id,user_department,user_fname,user_lname,user_email`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const users = (json.data || []).map((u: Record<string, unknown>) => ({
      user_id: Number(u.user_id ?? 0),
      user_department: u.user_department != null ? Number(u.user_department) : null,
      user_fname: u.user_fname as string | undefined,
      user_lname: u.user_lname as string | undefined,
      user_email: u.user_email as string | undefined,
      full_name: [u.user_fname, u.user_lname].filter(Boolean).join(" ").trim() || (u.user_email as string) || `#${u.user_id ?? ""}`,
    }));
    return NextResponse.json({ data: users });
  } catch (err) {
    return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : "Unknown" }, { status: 502 });
  }
}
