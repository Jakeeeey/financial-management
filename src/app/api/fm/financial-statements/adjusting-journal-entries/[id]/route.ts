import { NextRequest } from "next/server";
import { buildSpringItemPath, proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxySpring(buildSpringItemPath(id), { method: "GET" });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.text();
  return proxySpring(buildSpringItemPath(id), {
    method: "PUT",
    body,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxySpring(buildSpringItemPath(id), { method: "DELETE" });
}
