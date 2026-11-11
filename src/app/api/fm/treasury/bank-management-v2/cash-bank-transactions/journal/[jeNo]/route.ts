import { fetchJournalEntry } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/gl.service";

import { fail, handleRouteError, ok } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** One posted entry with its lines, so a journal number in the UI can be traced. */
export async function GET(_request: Request, { params }: { params: Promise<{ jeNo: string }> }) {
  const { jeNo } = await params;
  const number = decodeURIComponent(jeNo ?? "").trim().toUpperCase();
  if (!/^JE-\d{7}$/.test(number)) return fail("That journal entry number is not valid.", 400);

  try {
    const entry = await fetchJournalEntry(number);
    if (!entry) return fail(`Journal entry ${number} was not found.`, 404);
    return ok(entry);
  } catch (error) {
    return handleRouteError(error, "journal entry read failed", "The journal entry could not be read.");
  }
}
