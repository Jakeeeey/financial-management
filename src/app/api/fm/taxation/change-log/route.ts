import { NextResponse } from "next/server";
import { z } from "zod";

import { listRegistryCompanies } from "@/modules/financial-management/taxation/change-log/services/registry";
import { listChangeLog } from "@/modules/financial-management/taxation/change-log/services/changeLog.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  entity: z.string().trim().max(40).optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().trim().length(10).optional(),
  to: z.string().trim().length(10).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    companyId: url.searchParams.get("companyId") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    entity: url.searchParams.get("entity") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const fresh = url.searchParams.get("refresh") === "1";

  try {
    const [log, companies] = await Promise.all([
      listChangeLog(
        {
          companyId: input.companyId ?? null,
          year: input.year ?? null,
          entity: input.entity || "ALL",
          q: input.q || "",
          from: input.from || "",
          to: input.to || "",
          page: input.page,
        },
        { fresh },
      ),
      listRegistryCompanies().catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rows: log.rows,
        total: log.total,
        page: input.page,
        notice: log.notice ?? null,
        companies: companies.map((company) => ({
          companyId: company.companyId,
          name: company.name,
          code: company.code,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/fm/taxation/change-log failed", error);
    return NextResponse.json({ success: false, error: "Could not read the change log." }, { status: 500 });
  }
}
