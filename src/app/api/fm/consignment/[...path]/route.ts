import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

const ALLOWED_ROOTS = new Set(["consignees", "agreements", "documents", "reports", "controls"]);

async function forward(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  if (!path?.length || !ALLOWED_ROOTS.has(path[0])) {
    return NextResponse.json({ message: "Consignment API path not found." }, { status: 404 });
  }

  const springPath = `/api/consignment/${path.map((part) => encodeURIComponent(part)).join("/")}${request.nextUrl.search}`;
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  return proxySpring(springPath, { method, ...(body ? { body } : {}) });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
