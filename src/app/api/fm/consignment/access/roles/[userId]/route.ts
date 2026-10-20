import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0 || parsedUserId > 2_147_483_647) {
    return NextResponse.json({ message: "A valid userId is required." }, { status: 400 });
  }

  return proxySpring("/api/consignment/access/roles/" + encodeURIComponent(userId), {
    method: "DELETE",
  });
}
