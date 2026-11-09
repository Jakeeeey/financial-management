/**
 * E16–E18 posting rules, transcribed from FSD Table 14 (§3.5).
 *
 * Like every other Bank Management V2 module, no line names a literal GL code: the
 * FSD's 201800 / 232300 / 232200 / 100100 do not exist in this company's chart of
 * accounts, so each line names a mapping key resolved from `bank_gl_mapping` at
 * posting time. While a key is empty the entry stays unresolvable and posting refuses.
 */

import type { JournalEntryDraft, JournalLineDraft } from "./types";

const cr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({
  mappingKey,
  debit: 0,
  credit: amount,
  memo,
});
const dr = (mappingKey: string, amount: number, memo?: string): JournalLineDraft => ({
  mappingKey,
  debit: amount,
  credit: 0,
  memo,
});

export type Base = {
  sourceRef: string;
  postingDate: string;
  description: string;
};

/**
 * E16 — dormancy reclassification after 12 months without customer activity.
 * Dr the active deposit liability (201100/201200/201300) · Cr dormant liabilities (201800).
 */
export function dormancyReclassEntry(amount: number, base: Base): JournalEntryDraft {
  return {
    eventCode: "E16",
    sourceModule: "dormancy-account-closing",
    ...base,
    lines: [
      dr("DEPOSIT_LIABILITY_ACTIVE", amount, "Release active deposit liability"),
      cr("DORMANT_LIABILITY", amount, "Dormant deposit liability (201800)"),
    ],
  };
}

/**
 * E17 — escheatment after 10 years dormant (Act No. 3936).
 * Dr dormant liabilities (201800) · Cr statutory escheatment payable (232300).
 */
export function escheatEntry(amount: number, base: Base): JournalEntryDraft {
  return {
    eventCode: "E17",
    sourceModule: "dormancy-account-closing",
    ...base,
    lines: [
      dr("DORMANT_LIABILITY", amount, "Dormant liability escheated"),
      cr("ESCHEAT_PAYABLE", amount, "National Treasury payable (Act No. 3936)"),
    ],
  };
}

/**
 * E18 — closure settlement: accrued interest is charged to finance cost, 20% final
 * withholding tax goes to the statutory payable and the net payout leaves through the
 * closure clearing account (232200).
 */
export function closureSettlementEntry(
  accruedInterest: number,
  tax: number,
  netPayout: number,
  base: Base,
): JournalEntryDraft {
  const lines: JournalLineDraft[] = [
    dr("DEPOSIT_INTEREST_EXPENSE", accruedInterest, "Accrued interest to closing cut-off"),
    cr("FINAL_TAX_PAYABLE", tax, "20% final withholding tax"),
  ];
  if (netPayout > 0) {
    lines.push(cr("CLOSURE_PAYOUT", netPayout, "Net payout to depositor"));
  }
  return {
    eventCode: "E18",
    sourceModule: "dormancy-account-closing",
    ...base,
    lines,
  };
}
