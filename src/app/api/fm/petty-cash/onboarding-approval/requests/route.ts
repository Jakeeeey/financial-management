import { NextRequest } from "next/server";
import { forwardMaster } from "../../master-list/_routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return forwardMaster(request, "onboarding-approval", ["requests"]); }
