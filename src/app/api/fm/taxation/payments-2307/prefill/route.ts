import { NextResponse } from "next/server";

import { prefillBodySchema } from "@/modules/financial-management/taxation/payments-2307/schemas";
import { currentActor } from "@/modules/financial-management/taxation/payments-2307/services/actor";
import { prefillCertificates } from "@/modules/financial-management/taxation/payments-2307/services/certificates.service";
import { clearDeskCache } from "@/modules/financial-management/taxation/payments-2307/services/desk.service";
import { getRegistryCompany } from "@/modules/financial-management/taxation/payments-2307/services/registry";
import { fail, handleRouteError, ok, readJson } from "@/modules/financial-management/taxation/payments-2307/services/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    if (!body) return fail("Send a JSON object.", 400);

    const parsed = prefillBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail("Check the highlighted fields.", 400, parsed.error.flatten().fieldErrors);
    }

    const company = await getRegistryCompany(parsed.data.companyId);
    if (!company) {
      return fail("That company is not in the registry, so its ledger cannot be read.", 404);
    }

    const actor = await currentActor();
    const data = await prefillCertificates(company, parsed.data.year, actor);
    clearDeskCache(parsed.data.companyId);
    return ok(data);
  } catch (error) {
    return handleRouteError("POST prefill", error);
  }
}
