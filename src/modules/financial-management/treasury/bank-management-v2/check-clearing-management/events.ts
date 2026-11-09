/**
 * E01–E15 posting rules, transcribed from FSD Table 14.
 *
 * Each builder returns a `JournalEntryDraft` whose lines name a mapping key, never a
 * literal GL code: the FSD's codes (101100, 102100, 232100 …) are absent from this
 * company's chart of accounts, so the account is resolved at posting time from
 * `bank_gl_mapping`, or from the bank account's own linked GL when it has one.
 */

import type { BankAccountV2, JournalEntryDraft, JournalLineDraft } from "./types";

type AccountRef = Pick<BankAccountV2, "bankId" | "glCoaId"> | null | undefined;

/** A bank account's own GL when linked, otherwise the shared cash-in-bank mapping. */
export function accountGlKey(account: AccountRef): string {
  return account?.glCoaId ? `COA:${account.glCoaId}` : "CASH_IN_BANK";
}

const cr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({ mappingKey, debit: 0, credit: amount, memo });
const dr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({ mappingKey, debit: amount, credit: 0, memo });

type Base = {
  sourceRef: string;
  postingDate: string;
  description: string;
};

/** E01 — opening balance on onboarding. */
export function openingBalanceEntry(account: AccountRef, amount: number, base: Base): JournalEntryDraft {
  return {
    eventCode: "E01",
    sourceModule: "onboarding",
    ...base,
    lines: [dr(accountGlKey(account), amount, "Opening balance"), cr("OPENING_EQUITY", amount, "Opening equity")],
  };
}

/** E02 — bank credit memo: the bank added funds. */
export function creditMemoEntry(
  account: AccountRef,
  amount: number,
  counterKey: string,
  base: Base,
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
  base: Base,
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
  base: Base,
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
 * `leg` 1 moves money out of the sending account (E06 parks it in transfer-in-transit),
 * `leg` 2 settles into the receiving account on or after the value date.
 */
export function transferEntry(
  leg: "OUT" | "IN",
  from: AccountRef,
  to: AccountRef,
  amount: number,
  valueDateIsLater: boolean,
  base: Base,
): JournalEntryDraft {
  const eventCode = valueDateIsLater ? "E06" : "E05";

  if (leg === "OUT") {
    const destination = valueDateIsLater ? dr("TRANSFER_IN_TRANSIT", amount, "Transfer in transit") : dr(accountGlKey(to), amount, "Transfer received");
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

/** E07 — deposit slip saved: undeposited cash becomes bank cash. */
export function depositCashEntry(account: AccountRef, amount: number, base: Base): JournalEntryDraft {
  return {
    eventCode: "E07",
    sourceModule: "deposit",
    ...base,
    lines: [dr(accountGlKey(account), amount, "Cash deposited"), cr("CASH_ON_HAND", amount, "Undeposited cash")],
  };
}

/** E08 — deposit slip cancelled: mirror of E07. */
export function depositCancelEntry(account: AccountRef, amount: number, base: Base): JournalEntryDraft {
  return {
    eventCode: "E08",
    sourceModule: "deposit",
    ...base,
    lines: [dr("CASH_ON_HAND", amount, "Deposit slip cancelled"), cr(accountGlKey(account), amount, "Cash deposit reversed")],
  };
}

/** E09 issue, E10 clear, E11 return or cancel — issued checks sit in clearing until banked out. */
export function issuedCheckEntry(
  event: "E09" | "E10" | "E11",
  account: AccountRef,
  amount: number,
  counterKey: string,
  base: Base,
): JournalEntryDraft {
  const cash = accountGlKey(account);
  const lines =
    event === "E09"
      ? [dr(counterKey, amount, "Check issued"), cr("BANK_CLEARING", amount, "Check outstanding")]
      : event === "E10"
        ? [dr("BANK_CLEARING", amount, "Check cleared"), cr(cash, amount, "Bank cleared check")]
        : [dr("BANK_CLEARING", amount, "Check returned or cancelled"), cr(counterKey, amount, "Check reversed")];

  return { eventCode: event, sourceModule: "checks", ...base, lines };
}

/** E12 receive, E13 clear, E14 return or cancel, E15 dishonoured after deposit. */
export function receivedCheckEntry(
  event: "E12" | "E13" | "E14" | "E15",
  account: AccountRef,
  amount: number,
  base: Base,
): JournalEntryDraft {
  const cash = accountGlKey(account);
  const lines =
    event === "E12"
      ? [dr("BANK_CLEARING", amount, "Check received"), cr("AR_CONTROL", amount, "Customer settlement")]
      : event === "E13"
        ? [dr(cash, amount, "Check cleared"), cr("BANK_CLEARING", amount, "Check in clearing cleared")]
        : event === "E14"
          ? [dr("AR_CONTROL", amount, "Check returned"), cr("BANK_CLEARING", amount, "Check returned")]
          : [dr("AR_CONTROL", amount, "Check dishonoured"), cr(cash, amount, "Deposited check dishonoured")];

  return { eventCode: event, sourceModule: "checks", ...base, lines };
}
