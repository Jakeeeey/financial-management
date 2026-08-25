import { NextRequest } from "next/server";
import { buildSpringListPath, proxySpring } from "./_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxySpring(buildSpringListPath(request.nextUrl.searchParams), {
    method: "GET",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxySpring(buildSpringListPath(new URLSearchParams()), {
    method: "POST",
    body,
  });
}
