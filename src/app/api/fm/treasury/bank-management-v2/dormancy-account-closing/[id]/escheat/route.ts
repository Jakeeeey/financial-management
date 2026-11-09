import { NextResponse } from "next/server";

import {
  describeDormancyError,
  escheat,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

/** E17 — escheat a deposit dormant for ten years (Act No. 3936). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bankId = Number(id);
  if (!Number.isInteger(bankId) || bankId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid account id." }, { status: 400 });
  }

  try {
    const data = await escheat(bankId, null);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] escheat failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
