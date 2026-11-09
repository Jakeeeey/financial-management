import { NextResponse } from "next/server";
import { z } from "zod";

import { listAuditLog } from "@/modules/financial-management/treasury/bank-management-v2/bank-masterlist-audit-logs/services/masterlist.service";

export const dynamic = "force-dynamic";

const emptyToUndefined = (value: unknown) => (value === "" || value == null ? undefined : value);

const querySchema = z.object({
  module: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
  user: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  pht: z.preprocess(emptyToUndefined, z.enum(["PHT", "NOT_PHT"]).optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  from: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()),
  to: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()),
  page: z.preprocess((value) => Number(emptyToUndefined(value)), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((value) => Number(emptyToUndefined(value)), z.number().int().min(1).max(100).default(20)),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return NextResponse.json({ success: false, error: "`from` must not be after `to`" }, { status: 400 });
  }

  try {
    const data = await listAuditLog(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bank-management-v2] masterlist audit log failed", error);
    return NextResponse.json({ success: false, error: "Failed to load audit logs" }, { status: 500 });
  }
}
