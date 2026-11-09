import { NextResponse } from "next/server";

import { paymentBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { toPaymentInput } from "@/modules/financial-management/taxation/payments-2307/services/inputMappers";
import { deletePayment, updatePayment } from "@/modules/financial-management/taxation/payments-2307/services/payments.service";
import {
  fail,
  handleRouteError,
  ok,
  parseRowId,
  readJson,
} from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const id = parseRowId((await params).id);
    if (id === null) return fail("That payment id is not valid.", 400);

    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = paymentBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await updatePayment(id, toPaymentInput(parsed.data), actor);
    return ok(data);
  } catch (error) {
    return handleRouteError("PATCH payments/[id]", error);
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const id = parseRowId((await params).id);
    if (id === null) return fail("That payment id is not valid.", 400);

    const actor = await currentActor();
    const data = await deletePayment(id, actor);
    return ok(data);
  } catch (error) {
    return handleRouteError("DELETE payments/[id]", error);
  }
}
