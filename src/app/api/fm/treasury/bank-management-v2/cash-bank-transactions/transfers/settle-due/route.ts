import { settleDueTransfers } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/transfers.service";

import { currentUserId, handleRouteError, ok } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** The settle-many path: leg 2 for every transfer whose value date has arrived. */
export async function POST() {
  try {
    const userId = await currentUserId();
    return ok(await settleDueTransfers(userId));
  } catch (error) {
    return handleRouteError(error, "settle due transfers failed", "The due transfers could not be settled.");
  }
}
