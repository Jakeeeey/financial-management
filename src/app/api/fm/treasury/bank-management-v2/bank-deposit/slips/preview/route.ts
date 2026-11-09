import { NextResponse } from "next/server";
import { z } from "zod";

import { previewDepositSlip } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/deposit.service";
import { DirectusError } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/directus";

export const dynamic = "force-dynamic";

const PreviewSchema = z.object({
  bankAccountId: z.coerce.number().int().positive(),
  cashTotal: z.coerce.number().min(0).max(999_999_999_999),
});

/** E07 preview only — resolves the cash leg against `bank_gl_mapping`, writes nothing. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PreviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Some fields need attention.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ success: true, data: await previewDepositSlip(parsed.data) });
  } catch (error) {
    if (error instanceof DirectusError) {
      console.error("[bank-management-v2] deposit preview failed", error.status, error.body);
      return NextResponse.json({ success: false, error: "The journal preview could not be resolved." }, { status: 502 });
    }
    console.error("[bank-management-v2] deposit preview failed", error);
    return NextResponse.json({ success: false, error: "The journal preview could not be resolved." }, { status: 500 });
  }
}
