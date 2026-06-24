import { NextRequest, NextResponse } from "next/server";
import { buildSpringSourceJournalSearchPath, proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const springResponse = await proxySpring(buildSpringSourceJournalSearchPath(searchParams), {
    method: "GET",
  });

  if (springResponse.ok) {
    return springResponse;
  }

  if (springResponse.status === 401 || springResponse.status === 403) {
    return springResponse;
  }

  const errorBody = await springResponse.json().catch(() => null) as Record<string, unknown> | null;
  const detail = typeof errorBody?.message === "string"
    ? errorBody.message
    : `Spring search responded with HTTP ${springResponse.status}`;

  return NextResponse.json(
    {
      message: "Failed to search source journal entries",
      detail,
    },
    { status: 502 },
  );
}
