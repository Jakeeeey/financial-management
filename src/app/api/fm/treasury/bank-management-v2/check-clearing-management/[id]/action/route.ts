import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isCalendarDate,
  applyCheckAction,
  describeCheckError,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine(isCalendarDate, "Enter a valid calendar date.");

const ActionSchema = z.object({
  action: z.enum(["RELEASE", "DEPOSIT", "CLEAR", "RETURN", "CANCEL", "REPLACE"]),
  returnReason: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  replacement: z
    .object({
      checkDate: dateField,
      amount: z.coerce.number().positive("Enter an amount greater than zero."),
      checkNo: z.string().trim().max(40).optional(),
    })
    .optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const checkId = Number(id);
  if (!Number.isInteger(checkId) || checkId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid check id." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the action details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await applyCheckAction(checkId, {
      action: parsed.data.action,
      returnReason: parsed.data.returnReason ?? null,
      note: parsed.data.note ?? null,
      replacement: parsed.data.replacement
        ? {
            checkDate: parsed.data.replacement.checkDate,
            amount: parsed.data.replacement.amount,
            checkNo: parsed.data.replacement.checkNo ?? null,
          }
        : null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeCheckError(error, `[bank-management-v2] check action ${checkId} failed`);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
