import { NextResponse } from "next/server";

import {
  describeDormancyError,
  preClosure,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

/** FSD §3.5 step 1 — re-runs the closure checklist for one account. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bankId = Number(id);
  if (!Number.isInteger(bankId) || bankId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid account id." }, { status: 400 });
  }

  try {
    const data = await preClosure(bankId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] pre-closure check failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
