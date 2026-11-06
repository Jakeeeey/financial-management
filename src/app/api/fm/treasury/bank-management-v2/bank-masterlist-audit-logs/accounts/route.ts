import { NextResponse } from "next/server";
import { z } from "zod";

import { listAccounts } from "@/modules/financial-management/treasury/bank-management-v2/bank-masterlist-audit-logs/services/masterlist.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "DORMANT", "CLOSED"]).optional(),
  currency: z.enum(["PHP", "USD"]).optional(),
  q: z
    .string()
    .trim()
    .max(120, "Search text is too long")
    .optional()
    .transform((value) => value || undefined),
  reconciliation: z.enum(["RECONCILED", "UNRECONCILED"]).optional(),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await listAccounts(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bank-management-v2] masterlist accounts failed", error);
    return NextResponse.json({ success: false, error: "Failed to load bank accounts" }, { status: 500 });
  }
}
