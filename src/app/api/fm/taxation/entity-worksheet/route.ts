import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { listCompanies, publicCompany, loadEntitySnapshot, TaxonomyLookupError } from "@/modules/financial-management/taxation/entity-worksheet/services/worksheet.service";
import { clearSnapshotCache } from "@/modules/financial-management/taxation/entity-worksheet/services/worksheet.service";
import { saveProfile } from "@/modules/financial-management/taxation/entity-worksheet/services/profile.service";
import { currentActor } from "@/modules/financial-management/taxation/entity-worksheet/services/actor";
import { clearGroupCache } from "@/modules/financial-management/taxation/group-overview/services/groupOverview.service";
import { DirectusError } from "@/modules/financial-management/taxation/entity-worksheet/services/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
});

const ProfileSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  taxYear: z.coerce.number().int().min(2000).max(2100),
  assetsExcludingLand: z.coerce.number().min(0).max(1_000_000_000_000),
  taxableYearOfOperations: z.coerce.number().int().min(1).max(30),
  regime: z.enum(["REGULAR", "ENHANCED_DEDUCTIONS", "SCIT", "INCOME_TAX_HOLIDAY"]),
  registeredShare: z.coerce.number().min(0).max(100),
  deductionMethod: z.enum(["ITEMIZED", "OSD"]),
  withholdingAgent: z.boolean(),
  hasTopWithholdingStatus: z.boolean(),
  vatRegistered: z.boolean(),
  efpsGroup: z.enum(["A", "B", "C", "D", "E", "NONE"]),
  ownsRealProperty: z.boolean(),
  taxAgentFeeRate: z.coerce.number().min(0).max(100),
  priorYearExcessCredit: z.coerce.number().min(0).max(1_000_000_000_000),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId"),
    year: request.nextUrl.searchParams.get("year"),
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "A company and a tax year are required." }, { status: 400 });
  }

  try {
    // One health pass, reused by both halves: previously each call pinged all nine endpoints.
    const companies = await listCompanies();
    // The Spring itemized views take the user's own session token; reading it here keeps the
    // desk on the same credentials as the rest of the app instead of adding a service account.
    const cookieStore = await cookies();
    const springToken = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const fresh = request.nextUrl.searchParams.get("refresh") === "1";
    const snapshot = await loadEntitySnapshot(parsed.data.companyId, parsed.data.year, companies, springToken, {
      fresh,
    });
    return NextResponse.json({
      success: true,
      data: {
        companies: companies.map(publicCompany),
        // The snapshot embeds the company row too; the browser gets the stripped copy.
        snapshot: { ...snapshot, company: publicCompany(snapshot.company) },
      },
    });
  } catch (error) {
    if (error instanceof TaxonomyLookupError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[taxation/entity-worksheet GET]", error);
    return NextResponse.json({ success: false, error: "Could not build the worksheet." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the profile fields.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const saved = await saveProfile(
      { ...parsed.data, notes: parsed.data.notes ?? null },
      await currentActor(),
    );
    clearSnapshotCache(parsed.data.companyId, parsed.data.taxYear);
    clearGroupCache(parsed.data.taxYear);
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof DirectusError) {
      console.error("[taxation/entity-worksheet PATCH]", error.status, error.message, error.body);
      if (error.status === 403 || error.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The tax profile table is not reachable. Run the taxation DDL, then check the API token can write to tax_company_profile.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { success: false, error: describeDirectusError(error.body) ?? "The profile could not be saved." },
        { status: 502 },
      );
    }
    console.error("[taxation/entity-worksheet PATCH]", error);
    return NextResponse.json({ success: false, error: "The profile could not be saved." }, { status: 500 });
  }
}

/** Directus answers with `{ errors: [{ message }] }`; show that instead of a shrug. */
function describeDirectusError(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { errors?: Array<{ message?: string }> };
    const first = parsed.errors?.find((entry) => entry.message)?.message;
    return first ? `Directus: ${first}` : null;
  } catch {
    return null;
  }
}

