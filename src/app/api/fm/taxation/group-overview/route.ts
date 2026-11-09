import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DirectusError } from "@/modules/financial-management/taxation/group-overview/services/directus";
import { loadGroupOverview } from "@/modules/financial-management/taxation/group-overview/services/groupOverview.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export async function GET(request: NextRequest) {
  const rawYear = request.nextUrl.searchParams.get("year");
  const parsed = QuerySchema.safeParse({ year: rawYear === null || rawYear === "" ? undefined : rawYear });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "The tax year must be a whole number between 2000 and 2100." },
      { status: 400 },
    );
  }

  const taxYear = parsed.data.year ?? new Date().getFullYear();

  try {
    const data = await loadGroupOverview(taxYear);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof DirectusError) {
      console.error("[taxation/group-overview GET]", error.message, error.body);
      return NextResponse.json({ success: false, error: "Could not load the group overview." }, { status: 502 });
    }
    console.error("[taxation/group-overview GET]", error);
    return NextResponse.json({ success: false, error: "Could not build the group overview." }, { status: 500 });
  }
}
