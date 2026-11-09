import { NextResponse } from "next/server";

import { certificateBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import {
  deleteCertificate,
  updateCertificate,
} from "@/modules/financial-management/taxation/payments-2307/services/certificates.service";
import { toCertificateInput } from "@/modules/financial-management/taxation/payments-2307/services/inputMappers";
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
    if (id === null) return fail("That certificate id is not valid.", 400);

    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = certificateBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await updateCertificate(id, toCertificateInput(parsed.data), actor);
    return ok(data);
  } catch (error) {
    return handleRouteError("PATCH certificates/[id]", error);
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const id = parseRowId((await params).id);
    if (id === null) return fail("That certificate id is not valid.", 400);

    const actor = await currentActor();
    const data = await deleteCertificate(id, actor);
    return ok(data);
  } catch (error) {
    return handleRouteError("DELETE certificates/[id]", error);
  }
}
