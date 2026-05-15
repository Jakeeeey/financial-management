// src/app/api/fm/setup/departments/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies the Spring department lookup used by unscoped department consumers.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const springRes = await fetch(
      `${process.env.SPRING_API_BASE_URL}/api/departments`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!springRes.ok) throw new Error(await springRes.text());
    return NextResponse.json(await springRes.json());
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ message: errorMessage }, { status: 502 });
  }
}
