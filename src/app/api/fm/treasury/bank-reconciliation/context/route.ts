import { referenceResponse } from "../_references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return referenceResponse(async access => access);
}
