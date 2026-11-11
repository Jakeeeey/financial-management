import { NextResponse } from "next/server";

import {
  deactivateAccount,
  describeDormancyError,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

/** Freeze an ACTIVE/DORMANT account without closing it; the closure checklist gates it. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bankId = Number(id);
  if (!Number.isInteger(bankId) || bankId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid account id." }, { status: 400 });
  }

  try {
    const data = await deactivateAccount(bankId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] deactivate failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
