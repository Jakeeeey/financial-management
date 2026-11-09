import { cancelMemoBodySchema, fieldErrorsFromZod } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/schemas";
import { cancelMemo } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/memos.service";

import { currentUserId, fail, handleRouteError, ok, readJson, toId } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Cancels a posted memo: mirror journal entry, then REVERSED on the row. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const memoId = toId(id);
  if (!memoId) return fail("Invalid memo id.", 400);

  const payload = await readJson(request);
  if (payload === undefined) return fail("Invalid JSON body.", 400);

  const parsed = cancelMemoBodySchema.safeParse(payload);
  if (!parsed.success) {
    return fail("A cancellation reason is required.", 400, { fieldErrors: fieldErrorsFromZod(parsed.error) });
  }

  try {
    const userId = await currentUserId();
    return ok(await cancelMemo(memoId, parsed.data.reason, userId));
  } catch (error) {
    return handleRouteError(error, "memo cancel failed", "The memo could not be cancelled.");
  }
}
