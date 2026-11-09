import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCheckbookSeries,
  describeCheckError,
  listCheckbooks,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

const ListQuery = z.object({
  accountId: z.coerce.number().int().positive().optional(),
});

const SeriesSchema = z.object({
  bankAccountId: z.coerce.number().int("Pick a bank account.").positive("Pick a bank account."),
  seriesStart: z.string().trim().min(1, "Enter the first check number.").max(40),
  seriesEnd: z.string().trim().min(1, "Enter the last check number.").max(40),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = Object.fromEntries(
    [...params.entries()].map(([key, value]) => [key, value.trim() === "" ? undefined : value]),
  );

  const parsed = ListQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid account filter.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await listCheckbooks(parsed.data.accountId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeCheckError(error, "[bank-management-v2] checkbook list failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SeriesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the series range.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await createCheckbookSeries({
      bankAccountId: parsed.data.bankAccountId,
      seriesStart: parsed.data.seriesStart,
      seriesEnd: parsed.data.seriesEnd,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const failure = describeCheckError(error, "[bank-management-v2] checkbook create failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
