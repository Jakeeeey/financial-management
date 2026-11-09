import { NextResponse } from "next/server";
import { z } from "zod";

import { phtToday } from "@/modules/financial-management/taxation/payments-2307/pht";
import { loadDesk } from "@/modules/financial-management/taxation/payments-2307/services/desk.service";
import { fail, handleRouteError, ok } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = QuerySchema.safeParse({
      companyId: params.get("companyId") ?? undefined,
      year: params.get("year") ?? undefined,
    });

    if (!parsed.success) {
      return fail("The query is invalid.", 400, parsed.error.flatten().fieldErrors);
    }

    const year = parsed.data.year ?? Number(phtToday().slice(0, 4));
    const data = await loadDesk(parsed.data.companyId ?? null, year);
    return ok(data);
  } catch (error) {
    return handleRouteError("GET", error);
  }
}
