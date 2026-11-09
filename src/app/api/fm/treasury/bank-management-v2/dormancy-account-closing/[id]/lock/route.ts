import { NextResponse } from "next/server";
import { z } from "zod";

import {
  describeDormancyError,
  lockClosed,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-dormancy-account-closing/services/dormancy.service";

export const dynamic = "force-dynamic";

const LockBody = z.object({
  reason: z.string().trim().min(5).max(300),
});

/** FSD §3.5 step 3 — the permanent status lock with ten-year retention. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bankId = Number(id);
  if (!Number.isInteger(bankId) || bankId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid account id." }, { status: 400 });
  }

  const parsed = LockBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid closure request.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await lockClosed(bankId, parsed.data.reason, null);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeDormancyError(error, "[bank-management-v2] closure lock failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
