import { NextResponse } from "next/server";
import { z } from "zod";

import {
  clearChecks,
  describeCheckError,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

const ClearBody = z.object({
  entries: z
    .array(
      z.object({
        checkId: z.coerce.number().int().positive(),
        clearedDate: z.string().trim().min(10).max(10),
      }),
    )
    .min(1)
    .max(100),
});

/** Clear several checks at once; each row carries the date its own statement line shows. */
export async function POST(request: Request) {
  const parsed = ClearBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid clearing request.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await clearChecks(parsed.data.entries);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeCheckError(error, "[bank-management-v2] batch clear failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
