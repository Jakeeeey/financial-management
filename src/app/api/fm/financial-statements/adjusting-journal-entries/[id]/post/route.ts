import { NextRequest } from "next/server";
import { buildSpringItemPath, proxySpring } from "../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxySpring(buildSpringItemPath(id, "post"), { method: "POST" });
}
