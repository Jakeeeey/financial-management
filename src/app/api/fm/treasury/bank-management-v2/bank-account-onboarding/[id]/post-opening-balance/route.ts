import { NextResponse } from "next/server";
import { z } from "zod";

import {
  describeOnboardingError,
  postOpeningBalanceForAccount,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/services/onboarding.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IdParam = z.coerce.number().int().positive();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = IdParam.safeParse(rawId);
  if (!id.success) {
    return NextResponse.json({ success: false, error: "That account id is not valid." }, { status: 400 });
  }

  try {
    const data = await postOpeningBalanceForAccount(id.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeOnboardingError(error, "[bank-management-v2] opening balance retry failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
