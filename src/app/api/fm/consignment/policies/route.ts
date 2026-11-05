import { NextRequest } from "next/server";
import { readConsignment } from "../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return readConsignment("/api/consignment/policies"); }
export async function PUT(request: NextRequest) { return readConsignment("/api/consignment/policies", { method: "PUT", body: await request.text() }); }
