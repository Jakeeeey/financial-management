import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { listCalendar } from "@/modules/financial-management/taxation/tax-calendar/services/calendarQuery.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const parsed = QuerySchema.safeParse({
    companyId: url.searchParams.get("companyId") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const taxYear = parsed.data.year ?? new Date().getFullYear();
  const fresh = url.searchParams.get("refresh") === "1";
  const springToken = (await cookies()).get(COOKIE_NAME)?.value ?? null;

  try {
    const data = await listCalendar(taxYear, parsed.data.companyId ?? null, { fresh, springToken });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/fm/taxation/tax-calendar failed", error);
    return NextResponse.json({ success: false, error: "Could not build the tax calendar." }, { status: 500 });
  }
}
