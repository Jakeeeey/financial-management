import { NextResponse } from "next/server";
import { z } from "zod";

import {
  describeDormancyError,
  settleClosure,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

const SettleBody = z.object({
  accruedInterest: z.coerce.number().min(0).max(999_999_999_999),
  cutOff: z.string().trim().min(10).max(10),
});

/** E18 — post the accrued interest, 20% final tax and net payout at the cut-off. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bankId = Number(id);
  if (!Number.isInteger(bankId) || bankId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid account id." }, { status: 400 });
  }

  const parsed = SettleBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid settlement.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await settleClosure(bankId, parsed.data, null);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] closure settlement failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
