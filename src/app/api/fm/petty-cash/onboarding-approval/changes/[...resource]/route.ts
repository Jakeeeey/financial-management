import { NextRequest } from "next/server";
import { forwardMaster } from "../../../master-list/_routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string[] }> };
async function forward(request: NextRequest, context: Context) { return forwardMaster(request, "onboarding-approval", ["changes", ...(await context.params).resource]); }
export const GET = forward;
export const POST = forward;
