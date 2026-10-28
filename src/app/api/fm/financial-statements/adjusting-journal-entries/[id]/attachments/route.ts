import { NextRequest, NextResponse } from "next/server";
import { buildSpringItemPath, proxySpring } from "../../_spring";
import { uploadSupportingFile } from "../../_attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  return proxySpring(buildSpringItemPath((await params).id, "attachments"));
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "Choose a supporting file." }, { status: 400 });
    return await uploadSupportingFile((await params).id, file);
  } catch {
    return NextResponse.json({ message: "Supporting document upload failed." }, { status: 502 });
  }
}

