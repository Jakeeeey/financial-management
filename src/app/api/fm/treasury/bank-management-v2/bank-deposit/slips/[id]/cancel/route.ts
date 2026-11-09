import { NextResponse } from "next/server";
import { z } from "zod";

import {
  NotFoundError,
  ValidationError,
  cancelDepositSlip,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/deposit.service";
import { PostingBlockedError } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/gl.service";

export const dynamic = "force-dynamic";

const CancelSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters).").max(300),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const slipId = Number(id);
  if (!Number.isInteger(slipId) || slipId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid slip id." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CancelSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "A cancellation reason is required.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const slip = await cancelDepositSlip(slipId, parsed.data.reason);
    return NextResponse.json({ success: true, data: slip });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof PostingBlockedError) {
      return NextResponse.json(
        { success: false, error: error.message, missingMappingKeys: error.missingMappingKeys },
        { status: 409 },
      );
    }
    console.error("[bank-management-v2] deposit slip cancel failed", error);
    return NextResponse.json({ success: false, error: "The slip could not be cancelled." }, { status: 500 });
  }
}
