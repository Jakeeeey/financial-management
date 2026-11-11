import { repostMemoEntry } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/memos.service";
import { repostTransferEntry } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/transfers.service";

import { currentUserId, fail, handleRouteError, ok, toId } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** `credit`, `debit`, `interest` and `transfer` are the four kinds the register lists. */
const KINDS: Record<string, "MEMO" | "TRANSFER"> = {
  credit: "MEMO",
  debit: "MEMO",
  interest: "MEMO",
  transfer: "TRANSFER",
};

/**
 * Posts the journal entry a saved transaction is missing, rebuilding it from the row's own
 * columns. A second call answers 409 with the existing journal number.
 */
export async function POST(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await context.params;
  const family = KINDS[kind?.toLowerCase()];
  if (!family) return fail("Unknown transaction kind.", 400);

  const transactionId = toId(id);
  if (!transactionId) return fail("Invalid transaction id.", 400);

  try {
    const userId = await currentUserId();
    const result =
      family === "TRANSFER"
        ? await repostTransferEntry(transactionId, userId)
        : await repostMemoEntry(transactionId, userId);
    return ok(result);
  } catch (error) {
    return handleRouteError(error, "transaction post failed", "The journal entry could not be posted.");
  }
}
