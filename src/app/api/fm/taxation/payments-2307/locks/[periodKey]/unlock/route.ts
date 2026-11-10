import { NextResponse } from "next/server";

import { periodKeySchema, unlockBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { clearDeskCache } from "@/modules/financial-management/taxation/payments-2307/services/desk.service";
import { unlockPeriod } from "@/modules/financial-management/taxation/payments-2307/services/locks.service";
import { fail, handleRouteError, ok, readJson } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ periodKey: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const period = periodKeySchema.safeParse((await params).periodKey);
    if (!period.success) return fail("That period is not a quarter or ANNUAL.", 400);

    const body = await readJson(request);
    if (!body) return fail("Send a JSON object, with the reason for unlocking.", 400);

    const parsed = unlockBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await unlockPeriod(
      {
        companyId: parsed.data.companyId,
        taxYear: parsed.data.year,
        periodKey: period.data,
        reason: parsed.data.reason,
      },
      actor,
    );
    clearDeskCache(parsed.data.companyId);
    return ok(data);
  } catch (error) {
    return handleRouteError("POST locks/[periodKey]/unlock", error);
  }
}
