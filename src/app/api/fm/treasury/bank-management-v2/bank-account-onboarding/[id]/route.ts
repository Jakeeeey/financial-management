import { NextResponse } from "next/server";
import { z } from "zod";

import { updateAccountBodySchema } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/schemas";
import {
  describeOnboardingError,
  updateAccount,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/services/onboarding.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IdParam = z.coerce.number().int().positive();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = IdParam.safeParse(rawId);
  if (!id.success) {
    return NextResponse.json({ success: false, error: "That account id is not valid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = updateAccountBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await updateAccount(id.data, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeOnboardingError(error, "[bank-management-v2] account update failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
