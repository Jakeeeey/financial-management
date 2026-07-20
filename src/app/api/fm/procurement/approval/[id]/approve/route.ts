import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    let approved_by: number | null = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
      const userId = payload?.id || payload?.user_id || payload?.sub;
      if (userId) {
        const userRes = await fetch(
          `${DIRECTUS_URL}/items/user/${userId}?fields=user_id`,
          { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
        );
        if (userRes.ok) {
          const userData = await userRes.json();
          const uid = userData?.data?.user_id ?? userData?.data?.id;
          if (uid) approved_by = Number(uid);
        }
      }
    } catch { /* fallback */ }

    const res = await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        isApproved: 1,
        status: "approved",
        approved_by,
        approved_date: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "BFF Error", detail }, { status: 502 });
  }
}
