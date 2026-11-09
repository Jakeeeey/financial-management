import "server-only";

import { CREDIT_NATURE_OPTIONS } from "../constants";
import { creditMemoEntry, debitMemoEntry, interestEntry } from "../events";
import { phtStamp } from "../pht";
import type { MemoBody } from "../schemas";
import { getAccount } from "./accounts.service";
import { asNumber, asString, createItem, DirectusError, getItem, listItems, roundMoney, updateItem } from "./directus";
import { NotFoundError, ValidationError } from "./errors";
import { postJournalEntry, PostingBlockedError, reverseJournalEntry } from "./gl.service";

/**
 * Memo writes: credit memo (E02), debit memo (E03) and interest earned (E04).
 *
 * Every write posts through `postJournalEntry` first and stores the returned entry id on the
 * memo row, so a memo without a journal entry cannot exist. The REST API has no cross-collection
 * transaction: when the insert fails after the entry posted, the entry is reversed.
 */

const MEMOS = "bank_memos";
const ENTRIES = "bank_journal_entries";

const REF_PREFIX: Record<MemoBody["kind"], string> = {
  CREDIT: "BCM-",
  DEBIT: "BDM-",
  INTEREST: "INT-",
};

const FALLBACK_DESCRIPTION: Record<MemoBody["kind"], string> = {
  CREDIT: "Bank credit memo",
  DEBIT: "Bank debit memo",
  INTEREST: "Interest earned",
};

/** PHT wall clock, the shape the DDL stores. */
function storedStamp(): string {
  return phtStamp().replace("T", " ");
}

/** Creates one memo, posting its journal entry and storing the entry on the row. */
export async function createMemo(body: MemoBody, userId: number | null): Promise<{ refNo: string; jeNo: string }> {
  const account = await getAccount(body.bankAccountId);
  if (!account) throw new NotFoundError("That bank account could not be found.");

  const refNo = await nextRefNo(REF_PREFIX[body.kind]);
  const description = (body.description ?? "").trim();
  const base = {
    sourceRef: refNo,
    postingDate: body.valueDate,
    description: description || FALLBACK_DESCRIPTION[body.kind],
  };

  const payload: Record<string, unknown> = {
    ref_no: refNo,
    bank_account_id: account.bankId,
    memo_type: body.kind,
    currency: account.currency,
    value_date: body.valueDate,
    description: description || null,
    status: "POSTED",
    created_by: userId,
    created_at: storedStamp(),
  };

  let draft;
  if (body.kind === "CREDIT") {
    const nature = CREDIT_NATURE_OPTIONS.find((option) => option.value === body.natureKey);
    if (!nature) throw new ValidationError("Choose the nature of the credit.", "natureKey");

    const amount = roundMoney(body.amount);
    draft = creditMemoEntry(account, amount, nature.mappingKey, base);
    payload.amount = amount;
    payload.nature_key = nature.value;
  } else if (body.kind === "DEBIT") {
    const amount = roundMoney(body.amount);
    draft = debitMemoEntry(account, amount, body.expenseCoaId, base);
    payload.amount = amount;
    payload.nature_key = "BANK_CHARGES_EXPENSE";
    payload.expense_coa_id = body.expenseCoaId;
  } else {
    const gross = roundMoney(body.gross);
    const tax = roundMoney(gross * body.taxRate);
    draft = interestEntry(account, gross, tax, base);
    // The memo amount is the net credit, per FSD 1.2.
    payload.amount = roundMoney(gross - tax);
    payload.nature_key = "INTEREST_INCOME";
    payload.interest_gross = gross;
    payload.interest_tax = tax;
    payload.tax_rate = body.taxRate;
  }

  const entry = await postJournalEntry(draft, userId);
  payload.journal_entry_id = entry.id;

  try {
    await createItem(MEMOS, payload);
  } catch (error) {
    await reverseJournalEntry(entry.jeNo, userId).catch((reversalError: unknown) => {
      console.error("[cash-bank-transactions] memo insert failed and the reversal failed", error, reversalError);
    });
    throw error;
  }

  return { refNo, jeNo: entry.jeNo };
}

/** Cancels a posted memo: mirror entry first, then the status and the reason. */
export async function cancelMemo(
  memoId: number,
  reason: string,
  userId: number | null,
): Promise<{ id: number; status: string }> {
  const memo = await getItem<Record<string, unknown>>(MEMOS, memoId, [
    "id",
    "ref_no",
    "status",
    "description",
    "journal_entry_id",
    "bank_account_id",
  ]);
  if (!memo) throw new NotFoundError("That memo could not be found.");
  if (asString(memo.status).toUpperCase() !== "POSTED") {
    throw new ValidationError("Only a posted memo can be cancelled.");
  }

  const journalEntryId = asNumber(memo.journal_entry_id) || null;
  if (journalEntryId) {
    const entry = await getItem<{ je_no: string }>(ENTRIES, journalEntryId, ["je_no"]);
    const jeNo = asString(entry?.je_no);
    if (jeNo) {
      try {
        await reverseJournalEntry(jeNo, userId);
      } catch (error) {
        // An already-mirrored entry means the ledger is correct; only the row status is stale.
        const alreadyReversed = error instanceof PostingBlockedError && /already reversed/i.test(error.message);
        if (!alreadyReversed) throw error;
      }
    }
  }

  // ponytail: bank_memos has no cancel-reason column, so the reason rides in the description;
  // give it its own column when the DDL grows one.
  const previous = asString(memo.description);
  await updateItem(MEMOS, memoId, {
    status: "REVERSED",
    description: [previous, `Cancelled: ${reason}`].filter(Boolean).join("\n").slice(0, 2000),
  });

  return { id: memoId, status: "REVERSED" };
}

/** `BCM-0001`, `BDM-0007` — the next number for one memo type. */
async function nextRefNo(prefix: string): Promise<string> {
  try {
    const { rows } = await listItems<{ ref_no: string }>(MEMOS, {
      fields: ["ref_no"],
      filter: { ref_no: { _starts_with: prefix } },
      sort: "-ref_no",
      limit: 1,
    });
    const last = asString(rows[0]?.ref_no);
    const sequence = Number(last.slice(prefix.length)) || 0;
    return `${prefix}${String(sequence + 1).padStart(4, "0")}`;
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    return `${prefix}0001`;
  }
}
