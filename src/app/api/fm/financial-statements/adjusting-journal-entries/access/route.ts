import { proxySpring } from "../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return proxySpring("/api/financial-statements/adjusting-journal-entries/access"); }

