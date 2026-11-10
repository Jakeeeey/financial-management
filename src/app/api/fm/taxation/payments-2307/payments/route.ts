import { NextResponse } from "next/server";

import { paymentBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { clearDeskCache } from "@/modules/financial-management/taxation/payments-2307/services/desk.service";
import { toPaymentInput } from "@/modules/financial-management/taxation/payments-2307/services/inputMappers";
import { createPayment } from "@/modules/financial-management/taxation/payments-2307/services/payments.service";
import { fail, handleRouteError, ok, readJson } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = paymentBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await createPayment(toPaymentInput(parsed.data), actor);
    clearDeskCache(parsed.data.companyId);
    return ok(data);
  } catch (error) {
    return handleRouteError("POST payments", error);
  }
}
