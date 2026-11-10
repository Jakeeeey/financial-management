import type { ReconcileExportData } from "../export-types";

export class ReconcileExportError extends Error {}
export function exportTime(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(/[Zz]$|[+-]\d\d:\d\d$/.test(value) ? value : value + "+08:00");
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} PHT`;
}
export function exportMetadata(data: ReconcileExportData) {
  const { period: p } = data;
  return [data.entity?.name || "Entity not set", [p.bank.bankName, p.bank.branch, p.bank.maskedAccountNumber].filter(Boolean).join(" | "), `Currency ${p.currency} | Period ended ${p.periodEnd || "Not set"} | ${p.status === "CLOSED" ? "Closed" : "Open"}`, `Generated ${exportTime(data.generatedAt)} by ${data.generatedBy.name}`, `Ledger snapshot: ${exportTime(p.ledgerAsOf)}`];
}
export function summaryRows(data: ReconcileExportData): { label: string; value: string | null; money?: boolean }[] {
  const { period: p, reconciliation: r } = data;
  return [
    { label: "Statement opening balance", value: p.statementOpening ?? null, money: true },
    { label: "Statement ending balance", value: p.statementEnding ?? null, money: true },
    { label: "Ledger balance before adjustments", value: p.ledgerBalance, money: true },
    { label: "Adjusted bank balance", value: r.adjustedBankBalance, money: true },
    { label: "Adjusted book balance", value: r.adjustedBookBalance, money: true },
    { label: "Difference", value: r.difference, money: true },
    { label: "Status", value: r.statusLabel },
    { label: "Statement check", value: p.statementCheck.message },
    ...[...p.ledgerBlockers, p.setupWarning].filter((value): value is string => Boolean(value)).map(value => ({ label: "Setup guidance", value })),
  ];
}
