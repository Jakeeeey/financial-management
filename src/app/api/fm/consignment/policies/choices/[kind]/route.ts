import { NextRequest, NextResponse } from "next/server";
import { readConsignment } from "../../../_spring";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!["branches","accounts"].includes(kind)) return NextResponse.json({message:"Unknown choice type."},{status:400});
  return readConsignment(`/api/consignment/policies/choices/${kind}?${request.nextUrl.searchParams}`);
}
