import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function getSpringBaseUrl() {
  return (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  if (!query) {
    return NextResponse.json([]);
  }

  const params = new URLSearchParams({ query });
  const pouchId = request.nextUrl.searchParams.get("pouchId")?.trim();
  if (pouchId) {
    params.set("currentPouchId", pouchId);
  }

  try {
    const response = await fetch(
      `${getSpringBaseUrl()}/api/v1/collections/search-unpaid?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const rawBody = await response.text();
    let body: unknown = [];
    try {
      body = rawBody ? JSON.parse(rawBody) : [];
    } catch {
      body = { message: rawBody || `Spring GET Error: ${response.status}` };
    }

    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    console.error("[BFF search-unpaid Error]:", error);
    return NextResponse.json(
      {
        message: "BFF Error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
