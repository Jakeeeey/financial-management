import { readPettyCash } from "../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return readPettyCash("context"); }
