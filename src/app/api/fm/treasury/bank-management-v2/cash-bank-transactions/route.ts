import { fieldErrorsFromZod, memoBodySchema } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/schemas";
import { listTransactions } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/list.service";
import { createMemo } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/memos.service";
import type { TransactionFilters } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/types";

import { currentUserId, fail, handleRouteError, ok, readJson, toId } from "./_lib/http";

export const dynamic = "force-dynamic";

const KINDS: TransactionFilters["kind"][] = ["ALL", "CREDIT", "DEBIT", "INTEREST", "TRANSFER"];

function parseKind(raw: string | null): TransactionFilters["kind"] {
  const value = (raw ?? "").toUpperCase();
  return KINDS.includes(value as TransactionFilters["kind"]) ? (value as TransactionFilters["kind"]) : "ALL";
}

function parseDate(raw: string | null): string {
  const value = (raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/** The combined memo + transfer list, with the picklists the dialog needs. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const data = await listTransactions({
      kind: parseKind(searchParams.get("kind")),
      bankName: (searchParams.get("bank") ?? "").trim() || null,
      bankAccountId: toId(searchParams.get("bankAccountId")),
      status: (searchParams.get("status") ?? "").trim().toUpperCase(),
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
      q: (searchParams.get("q") ?? "").trim(),
      page: toId(searchParams.get("page")) ?? 1,
    });
    return ok(data);
  } catch (error) {
    return handleRouteError(error, "transaction list failed", "Could not load transactions.");
  }
}

/** Creates one memo: credit (E02), debit (E03) or interest earned (E04). */
export async function POST(request: Request) {
  const payload = await readJson(request);
  if (payload === undefined) return fail("Invalid JSON body.", 400);

  const parsed = memoBodySchema.safeParse(payload);
  if (!parsed.success) {
    return fail("Some fields need attention.", 400, { fieldErrors: fieldErrorsFromZod(parsed.error) });
  }

  try {
    const userId = await currentUserId();
    return ok(await createMemo(parsed.data, userId), 201);
  } catch (error) {
    return handleRouteError(error, "memo create failed", "The memo could not be saved.");
  }
}
