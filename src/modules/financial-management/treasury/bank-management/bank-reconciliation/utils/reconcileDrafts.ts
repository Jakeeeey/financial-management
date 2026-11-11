import type { SetupFields } from "../hooks/usePeriodSetup";
import type { TransactionSide } from "../transaction-types";

export type EntryFields = { date: string; reference: string; description: string; amount: string };
export type EntryDraft = { fields: EntryFields; initialDate: string; open: boolean; uncertain: boolean; reviewed: boolean };
export type EntryDrafts = Record<TransactionSide, EntryDraft>;
export const setupLabels = { companyId: "Entity", periodEnd: "Period ended", statementOpening: "Statement opening balance", statementEnding: "Statement ending balance" } as const;
export function emptyEntry(date = ""): EntryDraft { return { fields: { date, reference: "", description: "", amount: "" }, initialDate: date, open: false, uncertain: false, reviewed: false }; }
export function emptyEntries(date = ""): EntryDrafts { return { BANK: emptyEntry(date), LEDGER: emptyEntry(date) }; }
export function entryDirty(entry: EntryDraft) { return entry.uncertain || entry.fields.date !== entry.initialDate || Boolean(entry.fields.reference || entry.fields.description || entry.fields.amount); }
function amountKey(value: string) {
  const clean = value.trim().replaceAll(",", "");
  if (!clean) return "";
  if (!/^-?\d{1,16}(\.\d{1,2})?$/.test(clean)) return `invalid:${value}`;
  const [whole, fraction = ""] = clean.replace(/^-/, "").split(".");
  return String((BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * (clean.startsWith("-") ? -1n : 1n));
}
export function setupPatch(base: SetupFields, draft: SetupFields): Partial<SetupFields> {
  const patch: Partial<SetupFields> = {};
  for (const field of Object.keys(setupLabels) as (keyof typeof setupLabels)[]) {
    const equal = field === "statementOpening" || field === "statementEnding" ? amountKey(base[field]) === amountKey(draft[field]) : base[field] === draft[field];
    if (!equal) Object.assign(patch, { [field]: draft[field] });
  }
  return patch;
}
export function sameSetup(a: SetupFields, b: SetupFields) { return a.bankId === b.bankId && a.currency === b.currency && Object.keys(setupPatch(a, b)).length === 0; }export function entryValidation(entry: EntryDraft): string | null {
  const { date, amount, reference, description } = entry.fields;
  if (entry.uncertain) return "The earlier add result is unconfirmed. Review saved lines before allowing a retry.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1000 || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return "Enter a valid date.";
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount.trim())) return "Enter a nonzero amount with at most two decimal places.";
  const raw = amount.trim().replaceAll(",", "").replace(/^\+/, ""), [whole, fraction = ""] = raw.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (!cents || cents > 999999999999999999n) return "Enter a nonzero amount within the supported range.";
  if (reference.trim().length > 255 || description.trim().length > 1000) return "Reference allows 255 characters and description allows 1,000 characters.";
  return null;
}
