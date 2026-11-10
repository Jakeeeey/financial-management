import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  loadRateConfig,
  RateTableError,
  saveRateSetting,
  saveWithholdingRate,
} from "@/modules/financial-management/taxation/rates-references/services/rateConfig.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  companyId: z.coerce.number().int().positive().optional(),
});

const rate = z.coerce.number().min(0).max(1);
const money = z.coerce.number().min(0).max(1_000_000_000_000);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A rate needs an effective date.");

const SettingsSchema = z.object({
  kind: z.literal("SETTINGS"),
  companyId: z.coerce.number().int().positive(),
  rateId: z.coerce.number().int().positive().nullable(),
  effectiveFrom: iso,
  vat: rate,
  percentage: rate,
  corporate: rate,
  smallCorporate: rate,
  smallCorporateNtiCeiling: money,
  smallCorporateAssetCeiling: money,
  mcit: rate,
  mcitStartYear: z.coerce.number().int().min(1).max(30),
  scit: rate,
  osd: rate,
  finalTaxInterest: rate,
  notes: z.string().max(500).nullable(),
});

const WithholdingSchema = z.object({
  kind: z.literal("WITHHOLDING"),
  companyId: z.coerce.number().int().positive(),
  rateId: z.coerce.number().int().positive().nullable(),
  incomeType: z.enum(["RENT", "FEE", "SERVICES", "CONSTRUCTION", "GOODS", "OTHER"]),
  rateTier: z.enum(["LARGE", "MEDIUM", "SMALL"]).nullable(),
  rate,
  requiresTopWithholdingAgent: z.boolean(),
  effectiveFrom: iso,
});

const BodySchema = z.discriminatedUnion("kind", [SettingsSchema, WithholdingSchema]);

function failure(error: unknown): NextResponse {
  if (error instanceof RateTableError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 503 });
  }
  return NextResponse.json({ success: false, error: "The rate table could not be reached." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({ companyId: request.nextUrl.searchParams.get("companyId") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "That company id is not valid." }, { status: 400 });
  }

  try {
    const config = await loadRateConfig(parsed.data.companyId ?? null);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "That rate is not valid." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.kind === "SETTINGS") {
      return NextResponse.json({ success: true, data: await saveRateSetting(parsed.data.companyId, parsed.data) });
    }
    return NextResponse.json({ success: true, data: await saveWithholdingRate(parsed.data.companyId, parsed.data) });
  } catch (error) {
    return failure(error);
  }
}
