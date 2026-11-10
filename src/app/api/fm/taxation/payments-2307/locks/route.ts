import { NextResponse } from "next/server";

import { lockBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { clearDeskCache } from "@/modules/financial-management/taxation/payments-2307/services/desk.service";
import { lockPeriod } from "@/modules/financial-management/taxation/payments-2307/services/locks.service";
import { fail, handleRouteError, ok, readJson } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = lockBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await lockPeriod(
      {
        companyId: parsed.data.companyId,
        taxYear: parsed.data.year,
        periodKey: parsed.data.periodKey,
        reason: parsed.data.reason,
      },
      actor,
    );
    clearDeskCache(parsed.data.companyId);
    return ok(data);
  } catch (error) {
    return handleRouteError("POST locks", error);
  }
}
