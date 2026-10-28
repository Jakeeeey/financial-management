import { NextRequest } from "next/server";
import { readConsignment } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return readConsignment(`/api/consignment/agreements?${request.nextUrl.searchParams.toString()}`); }
export async function POST(request: NextRequest) { return readConsignment("/api/consignment/agreements", { method: "POST", body: await request.text() }); }
