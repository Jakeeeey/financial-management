import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CLEARING_MAPPING_KEYS } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/constants";
import { listGlMapping, saveGlMapping } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/services/gl.service";
import { countDueTransfers } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/transfers.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  updates: z
    .array(
      z.object({
        mappingKey: z.string().trim().min(1).max(64),
        coaId: z.number().int().positive().nullable(),
      }),
    )
    .min(1)
    .max(50),
});

async function currentUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const payload = token ? decodeJwtPayload(token) : null;
  const id = Number(payload?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Saves posting-setup mappings and reports how many parked transfers the save just unblocked.
 * The count only appears when the save touched a clearing key and both clearing keys resolve;
 * settling stays a user action, never a side effect of the save.
 */
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the mapping rows.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const mapping = await saveGlMapping(parsed.data.updates, await currentUserId());
    const touchedClearing = parsed.data.updates.some((update) =>
      (CLEARING_MAPPING_KEYS as readonly string[]).includes(update.mappingKey),
    );
    const clearingResolved = CLEARING_MAPPING_KEYS.every((key) =>
      mapping.some((row) => row.mappingKey === key && row.coaId !== null),
    );
    const dueTransfers = touchedClearing && clearingResolved ? await countDueTransfers() : 0;
    return NextResponse.json({ success: true, data: { mapping, dueTransfers } });
  } catch (error) {
    console.error("[bank-management-v2] posting mapping save failed", error);
    return NextResponse.json(
      { success: false, error: "The mapping could not be saved. Check the banking instance and try again." },
      { status: 500 },
    );
  }
}

/** The strip's initial state comes from the register read; this keeps the route usable alone. */
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: { mapping: await listGlMapping(), dueTransfers: 0 } });
  } catch (error) {
    console.error("[bank-management-v2] posting mapping read failed", error);
    return NextResponse.json({ success: false, error: "The mapping could not be read." }, { status: 500 });
  }
}
