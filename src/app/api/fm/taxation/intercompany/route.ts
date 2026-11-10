import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DirectusError } from "@/modules/financial-management/taxation/intercompany/services/directus";
import {
  IntercompanyLookupError,
  loadIntercompanyLedger,
} from "@/modules/financial-management/taxation/intercompany/services/intercompany.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim();
  const parsed = QuerySchema.safeParse({
    companyId: companyId ? companyId : undefined,
    year: request.nextUrl.searchParams.get("year")?.trim(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "A tax year between 2000 and 2100 is required, and companyId must be a positive integer." },
      { status: 400 },
    );
  }

  try {
    const fresh = request.nextUrl.searchParams.get("refresh") === "1";
    const data = await loadIntercompanyLedger(
      { companyId: parsed.data.companyId, year: parsed.data.year },
      { fresh },
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof IntercompanyLookupError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof DirectusError) {
      console.error("[taxation/intercompany GET]", error.message, error.body);
      return NextResponse.json({ success: false, error: "The group registry could not be read." }, { status: 502 });
    }
    console.error("[taxation/intercompany GET]", error);
    return NextResponse.json({ success: false, error: "Could not build the intercompany ledger." }, { status: 502 });
  }
}
