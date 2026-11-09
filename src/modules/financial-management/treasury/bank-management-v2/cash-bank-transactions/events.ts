/**
 * E02–E06 posting rules for the transactions lane, from FSD Table 14.
 *
 * Each builder returns a `JournalEntryDraft` whose lines name a mapping key, never a literal
 * GL code: the account is resolved at posting time from `bank_gl_mapping`, or from the bank
 * account's own linked GL when it has one. The builders stay pure so the transfer service can
 * append its fee leg before posting.
 */

import type { JournalEntryDraft, JournalLineDraft } from "./types";

type AccountRef = { bankId: number; glCoaId: number | null } | null | undefined;

/** A bank account's own GL when linked, otherwise the shared cash-in-bank mapping. */
export function accountGlKey(account: AccountRef): string {
  return account?.glCoaId ? `COA:${account.glCoaId}` : "CASH_IN_BANK";
}

const cr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({ mappingKey, debit: 0, credit: amount, memo });
const dr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({ mappingKey, debit: amount, credit: 0, memo });

export type EntryBase = {
  sourceRef: string;
  postingDate: string;
  description: string;
};

/** E02 — bank credit memo: the bank added funds. */
export function creditMemoEntry(
  account: AccountRef,
  amount: number,
  counterKey: string,
  base: EntryBase,
): JournalEntryDraft {
  return {
    eventCode: "E02",
    sourceModule: "transactions",
    ...base,
    lines: [dr(accountGlKey(account), amount, "Credit memo"), cr(counterKey, amount, "Credit memo contra")],
  };
}

/** E03 — bank debit memo: the bank took funds for a charge or expense. */
export function debitMemoEntry(
  account: AccountRef,
  amount: number,
  expenseCoaId: number,
  base: EntryBase,
): JournalEntryDraft {
  return {
    eventCode: "E03",
    sourceModule: "transactions",
    ...base,
    lines: [dr(`COA:${expenseCoaId}`, amount, "Bank charge"), cr(accountGlKey(account), amount, "Debit memo")],
  };
}

/** E04 — interest earned, gross with final tax withheld at source. */
export function interestEntry(
  account: AccountRef,
  gross: number,
  tax: number,
  base: EntryBase,
): JournalEntryDraft {
  const net = Math.round((gross - tax) * 100) / 100;
  const lines = [dr(accountGlKey(account), net, "Interest credited")];
  if (tax > 0) lines.push(dr("FINAL_TAX_EXPENSE", tax, "Final tax withheld"));
  lines.push(cr("INTEREST_INCOME", gross, "Interest earned"));
  return { eventCode: "E04", sourceModule: "transactions", ...base, lines };
}

/**
 * E05 — same-day transfer; E06 — transfer with a later value date.
 *
 * `leg` OUT moves money out of the sending account (E06 parks it in transfer-in-transit),
 * `leg` IN settles into the receiving account on or after the value date.
 */
export function transferEntry(
  leg: "OUT" | "IN",
  from: AccountRef,
  to: AccountRef,
  amount: number,
  valueDateIsLater: boolean,
  base: EntryBase,
): JournalEntryDraft {
  const eventCode = valueDateIsLater ? "E06" : "E05";

  if (leg === "OUT") {
    const destination = valueDateIsLater
      ? dr("TRANSFER_IN_TRANSIT", amount, "Transfer in transit")
      : dr(accountGlKey(to), amount, "Transfer received");
    return {
      eventCode,
      sourceModule: "transactions",
      ...base,
      lines: [destination, cr(accountGlKey(from), amount, "Transfer sent")],
    };
  }

  return {
    eventCode,
    sourceModule: "transactions",
    ...base,
    lines: [dr(accountGlKey(to), amount, "Transfer settled"), cr("TRANSFER_IN_TRANSIT", amount, "Transfer in transit cleared")],
  };
}
