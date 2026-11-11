import "server-only";

import { CREDIT_NATURE_OPTIONS } from "../constants";
import { creditMemoEntry, debitMemoEntry, interestEntry } from "../events";
import { phtStamp } from "../pht";
import type { MemoBody } from "../schemas";
import { getAccount } from "./accounts.service";
import { asNumber, asString, createItem, DirectusError, getItem, listItems, roundMoney, updateItem } from "./directus";
import { NotFoundError, ValidationError } from "./errors";
import { postJournalEntry, PostingBlockedError, reverseJournalEntry } from "./gl.service";
import { findSourceEntry, isMissingItem } from "./repost.service";

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

/**
 * Posts the entry a saved memo is missing, rebuilding the draft from the columns the memo
 * stored. Idempotent: `bank_journal_entries` is unique on (source_ref, event_code), so an
 * entry that already exists is reported instead of written twice.
 */
export async function repostMemoEntry(
  memoId: number,
  userId: number | null,
): Promise<{ id: number; jeNo: string; eventCode: string; lines: number }> {
  let memo: Record<string, unknown> | null;
  try {
    memo = await getItem<Record<string, unknown>>(MEMOS, memoId, [
      "id",
      "ref_no",
      "bank_account_id",
      "memo_type",
      "amount",
      "value_date",
      "description",
      "status",
      "nature_key",
      "expense_coa_id",
      "interest_gross",
      "interest_tax",
    ]);
  } catch (readError) {
    if (!isMissingItem(readError)) throw readError;
    memo = null;
  }
  if (!memo) throw new NotFoundError("That memo could not be found.");
  if (asString(memo.status).toUpperCase() === "REVERSED") {
    throw new ValidationError("A cancelled memo cannot be posted again.");
  }

  const account = await getAccount(asNumber(memo.bank_account_id));
  if (!account) throw new ValidationError("The bank account on this memo no longer exists.");

  const kind = asString(memo.memo_type).toUpperCase();
  const refNo = asString(memo.ref_no);
  const description = asString(memo.description);
  const base = {
    sourceRef: refNo,
    postingDate: asString(memo.value_date),
    description: description || FALLBACK_DESCRIPTION[kind as MemoBody["kind"]] || "Bank memo",
  };
  const amount = roundMoney(asNumber(memo.amount));

  let draft;
  if (kind === "DEBIT") {
    draft = debitMemoEntry(account, amount, asNumber(memo.expense_coa_id), base);
  } else if (kind === "INTEREST") {
    draft = interestEntry(
      account,
      roundMoney(asNumber(memo.interest_gross)),
      roundMoney(asNumber(memo.interest_tax)),
      base,
    );
  } else {
    const nature = CREDIT_NATURE_OPTIONS.find((option) => option.value === asString(memo.nature_key));
    if (!nature) {
      throw new ValidationError("This memo does not record the nature of the credit, so its entry cannot be rebuilt.");
    }
    draft = creditMemoEntry(account, amount, nature.mappingKey, base);
  }

  const existing = await findSourceEntry(draft.sourceRef, draft.eventCode);
  if (existing) throw new ValidationError(`This memo already has journal entry ${existing}.`);

  const entry = await postJournalEntry(draft, userId);
  await updateItem(MEMOS, memoId, { journal_entry_id: entry.id });

  return { id: memoId, jeNo: entry.jeNo, eventCode: entry.eventCode, lines: entry.lines.length };
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
