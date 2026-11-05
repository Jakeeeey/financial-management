import { NextRequest } from "next/server";
import { workflowRecord } from "../../_workflow";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { return workflowRecord(request,context,"approvals"); }
