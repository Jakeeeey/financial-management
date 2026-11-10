import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { phtToday } from "@/modules/financial-management/taxation/vat-withholding/pht";
import { DirectusError } from "@/modules/financial-management/taxation/vat-withholding/services/directus";
import { listRegistryCompaniesWithHealth } from "@/modules/financial-management/taxation/vat-withholding/services/registry";
import {
  CompanyNotFoundError,
  loadVatWithholding,
} from "@/modules/financial-management/taxation/vat-withholding/services/vatWithholding.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).default(Number(phtToday().slice(0, 4))),
});

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const parsed = querySchema.safeParse({
    companyId: url.searchParams.get("companyId") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 },
    );
  }

  const fresh = url.searchParams.get("refresh") === "1";
  const springToken = (await cookies()).get(COOKIE_NAME)?.value ?? null;

  try {
    const companies = await listRegistryCompaniesWithHealth({ fresh });
    // No company asked for: open on the first one in the registry rather than a guessed id.
    const companyId = parsed.data.companyId ?? companies[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ success: false, error: "No active company in the registry" }, { status: 404 });
    }
    const data = await loadVatWithholding(companyId, parsed.data.year, companies, { fresh, springToken });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof DirectusError) {
      return NextResponse.json(
        { success: false, error: `The company registry is unavailable (${error.status})` },
        { status: 502 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
