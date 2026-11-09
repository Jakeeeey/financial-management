import { fieldErrorsFromZod, settleTransferBodySchema } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/schemas";
import { settleTransfer } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/transfers.service";

import { currentUserId, fail, handleRouteError, ok, readJson, toId } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Posts E06 leg 2 and closes a transfer that was parked in clearing. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const transferId = toId(id);
  if (!transferId) return fail("Invalid transfer id.", 400);

  const payload = await readJson(request);
  const parsed = settleTransferBodySchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return fail("Some fields need attention.", 400, { fieldErrors: fieldErrorsFromZod(parsed.error) });
  }

  try {
    const userId = await currentUserId();
    return ok(await settleTransfer(transferId, parsed.data.note ?? null, userId));
  } catch (error) {
    return handleRouteError(error, "transfer settle failed", "The transfer could not be settled.");
  }
}
