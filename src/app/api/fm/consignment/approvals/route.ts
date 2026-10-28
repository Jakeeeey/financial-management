import { NextRequest } from "next/server";
import { workflowList } from "../_workflow";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return workflowList(request,"approvals"); }
