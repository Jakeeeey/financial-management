import { NextResponse } from "next/server";

import { certificateBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { createCertificate } from "@/modules/financial-management/taxation/payments-2307/services/certificates.service";
import { toCertificateInput } from "@/modules/financial-management/taxation/payments-2307/services/inputMappers";
import { fail, handleRouteError, ok, readJson } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = certificateBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const actor = await currentActor();
    const data = await createCertificate(toCertificateInput(parsed.data), actor);
    return ok(data);
  } catch (error) {
    return handleRouteError("POST certificates", error);
  }
}
