import { NextRequest } from "next/server";
import { proxySpring } from "../../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PATH = "/api/financial-statements/adjusting-journal-entries/controls/period";
export async function GET() { return proxySpring(PATH); }
export async function PUT(request: NextRequest) { return proxySpring(PATH, { method: "PUT", body: await request.text() }); }

