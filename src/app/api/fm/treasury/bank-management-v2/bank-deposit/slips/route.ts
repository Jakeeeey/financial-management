import { NextResponse } from "next/server";
import { z } from "zod";

import {
  NotFoundError,
  ValidationError,
  createDepositSlip,
  listDepositSlips,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/deposit.service";
import { DirectusError } from "@/modules/financial-management/treasury/bank-management-v2/bank-deposit/services/directus";

export const dynamic = "force-dynamic";

const CreateSlipSchema = z.object({
  bankAccountId: z.coerce.number().int().positive(),
  depositDate: z.string().min(10),
  slipNo: z.string().trim().min(1, "Slip or validation number is required.").max(40),
  remarks: z.string().trim().max(500).nullish().transform((value) => value ?? null),
  cashIds: z.array(z.coerce.number().int().positive()).default([]),
  checkIds: z.array(z.coerce.number().int().positive()).default([]),
});

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await listDepositSlips() });
  } catch (error) {
    console.error("[bank-management-v2] deposit slips failed", error);
    return NextResponse.json({ success: false, error: "Could not load deposit slips." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CreateSlipSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Some fields need attention.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await createDepositSlip(parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message, fieldErrors: error.field ? { [error.field]: [error.message] } : undefined },
        { status: 400 },
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof DirectusError) {
      console.error("[bank-management-v2] deposit slip write failed", error.status, error.body);
      return NextResponse.json({ success: false, error: "The deposit slip could not be saved." }, { status: 502 });
    }
    console.error("[bank-management-v2] deposit slip create failed", error);
    return NextResponse.json({ success: false, error: "The deposit slip could not be saved." }, { status: 500 });
  }
}
