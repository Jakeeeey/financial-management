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

    const currentRes = await fetch(`${DIRECTUS_URL}/items/procurement/${id}?fields=id,isApproved,status`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!currentRes.ok) throw new Error(await currentRes.text());
    const current = (await currentRes.json())?.data;
    if (!current) return NextResponse.json({ message: "Not Found", detail: "Procurement not found" }, { status: 404 });

    const alreadyApproved = current.isApproved === 1 || current.isApproved === "1" || current.isApproved === true;
    if (alreadyApproved) {
      return NextResponse.json({ message: "Validation Error", detail: "Procurement is already approved" }, { status: 400 });
    }
    if (String(current.status ?? "").toLowerCase() === "rejected") {
      return NextResponse.json({ message: "Validation Error", detail: "Procurement is already rejected" }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/procurement/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rejected",
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
