import { NextResponse } from "next/server";
import { z } from "zod";

import {
  describeCheckError,
  listCheckRegister,
} from "@/modules/financial-management/treasury/bank-management-v2/check-clearing-management/services/checks.service";

export const dynamic = "force-dynamic";

const RegisterQuery = z.object({
  direction: z.enum(["ISSUED", "RECEIVED"]).optional(),
  status: z.enum(["PENDING", "RECEIVED", "IN_CLEARING", "CLEARED", "RETURNED", "CANCELLED"]).optional(),
  accountId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = Object.fromEntries(
    [...params.entries()].map(([key, value]) => [key, value.trim() === "" ? undefined : value]),
  );

  const parsed = RegisterQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid register filters.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await listCheckRegister({
      direction: parsed.data.direction,
      status: parsed.data.status,
      accountId: parsed.data.accountId,
      q: parsed.data.q,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeCheckError(error, "[bank-management-v2] check register failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
