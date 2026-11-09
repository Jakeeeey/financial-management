import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isCalendarDate,
  describeCheckError,
  issueCheck,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

const IssueSchema = z.object({
  bankAccountId: z.coerce.number().int("Pick a bank account.").positive("Pick a bank account."),
  checkDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .refine(isCalendarDate, "Enter a valid calendar date."),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  payee: z.string().trim().min(1, "Enter the payee.").max(200),
  remarks: z.string().trim().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = IssueSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the check details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await issueCheck({
      bankAccountId: parsed.data.bankAccountId,
      checkDate: parsed.data.checkDate,
      amount: parsed.data.amount,
      payee: parsed.data.payee,
      remarks: parsed.data.remarks ?? null,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const failure = describeCheckError(error, "[bank-management-v2] check issue failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
