import { NextRequest, NextResponse } from "next/server";
import { readConsignment } from "./_spring";

type Workspace = "consignees" | "my-submissions" | "approvals";
export function workflowList(request: NextRequest, workspace: Workspace) {
  return readConsignment(`/api/consignment/${workspace}?${request.nextUrl.searchParams.toString()}`);
}
export async function workflowRecord(request: NextRequest, context: { params: Promise<{ id: string }> }, workspace: Workspace, method = "GET", action = "") {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "Invalid consignee ID." }, { status: 400 });
  return readConsignment(`/api/consignment/${workspace}/${encodeURIComponent(id)}${action ? `/${action}` : ""}`, method === "GET" ? undefined : { method, body: await request.text() });
}
