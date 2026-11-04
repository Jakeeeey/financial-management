import { NextResponse } from "next/server";
import { isPettyCashWorkspace } from "@/modules/financial-management/petty-cash/types";
import { readPettyCash } from "../../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!isPettyCashWorkspace(workspace)) return NextResponse.json({ code: "NOT_FOUND", message: "Unknown Petty Cash workspace.", requestId: crypto.randomUUID() }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return readPettyCash(`workspaces/${workspace}`);
}
