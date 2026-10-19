import { NextRequest, NextResponse } from "next/server";
import { buildSpringItemPath, proxySpring } from "../../../_spring";
import { downloadSupportingFile } from "../../../_attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; attachmentId: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  const { id, attachmentId } = await params;
  try { return await downloadSupportingFile(id, attachmentId); }
  catch { return NextResponse.json({ message: "Supporting document service is unavailable." }, { status: 502 }); }
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id, attachmentId } = await params;
  return proxySpring(buildSpringItemPath(id, `attachments/${encodeURIComponent(attachmentId)}`), { method: "DELETE" });
}

