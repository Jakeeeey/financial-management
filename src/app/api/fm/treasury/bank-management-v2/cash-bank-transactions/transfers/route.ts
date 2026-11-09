import { fieldErrorsFromZod, transferBodySchema } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/schemas";
import { createTransfer } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/transfers.service";

import { currentUserId, fail, handleRouteError, ok, readJson } from "../_lib/http";

export const dynamic = "force-dynamic";

/**
 * Creates a fund transfer. Same-day value date posts E05 in one entry; a later value date posts
 * E06 leg 1 and leaves the row PENDING until it is settled.
 */
export async function POST(request: Request) {
  const payload = await readJson(request);
  if (payload === undefined) return fail("Invalid JSON body.", 400);

  const parsed = transferBodySchema.safeParse(payload);
  if (!parsed.success) {
    return fail("Some fields need attention.", 400, { fieldErrors: fieldErrorsFromZod(parsed.error) });
  }

  try {
    const userId = await currentUserId();
    return ok(await createTransfer(parsed.data, userId), 201);
  } catch (error) {
    return handleRouteError(error, "transfer create failed", "The transfer could not be saved.");
  }
}
