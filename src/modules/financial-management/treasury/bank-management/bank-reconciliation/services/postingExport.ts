import type { PostingEntry, PostingExportData } from "../posting-types";
import { exportTime } from "./reconcileExport";

export const POSTING_TOTAL_NOTE = "Journal totals include all displayed drafts and attempts. Only confirmed GL postings affect the cash summary. This report is not a GL import file.";
export function postingStatus(entry: PostingEntry) {
  if (entry.reversedByNumber) return `Reversed by ${entry.reversedByNumber}`;
  if (entry.status === "REVERSAL") return `Reverses ${entry.reversesNumber || "original journal"}`;
  return { NEEDS_ACCOUNT: "Needs account", READY: "Ready", PENDING: "Pending GL", EXPORTED: "Exported - awaiting GL verification", FAILED: "Failed", POSTED: "Posted", REVERSED: "Reversed", REVERSAL: "Reversal", WITHDRAWN: "Withdrawn", SUPERSEDED: "Superseded" }[entry.status];
}
export function postingExplanation(entry: PostingEntry) {
  return [entry.explanation, entry.lastError, entry.stale ? "The source changed; this attempt retains its recorded values." : "", ...entry.issues].filter(Boolean).join("\n");
}
export function postingSummary(data: PostingExportData): { label: string; value: string | null; money?: boolean }[] {
  return [
    { label: "Ledger before adjustments", value: data.summary.ledgerBefore, money: true },
    { label: "Posted, net to cash", value: data.summary.postedCashEffect, money: true },
    { label: "Ledger after posting", value: data.summary.ledgerAfter, money: true },
    { label: "Adjusted book balance", value: data.summary.adjustedBookBalance, money: true },
    { label: "Still to post", value: data.summary.stillToPost, money: true },
    { label: "Posting date", value: data.postingDate.effective || "Not set" },
    { label: "Reconciliation", value: data.reconciliation.statusLabel },
    ...[...data.period.ledgerBlockers, data.period.setupWarning, data.postingDate.message].filter((s): s is string => Boolean(s)).map(value => ({ label: "Review", value })),
    { label: "Journal totals", value: POSTING_TOTAL_NOTE },
  ];
}
export function postingDetails(entry: PostingEntry) {
  return [postingStatus(entry), `Source: ${entry.sourceLabel}`, entry.importReference && `Import reference: ${entry.importReference}`, entry.journalNumber && `GL: ${entry.journalNumber}${entry.journalId ? ` (ID ${entry.journalId})` : ""}`, entry.postedBy && `Posted by ${entry.postedBy}`, entry.postedAt && `Posted at ${exportTime(entry.postedAt)}`, entry.reversesNumber && `Reverses ${entry.reversesNumber}`, entry.reversedByNumber && `Reversed by ${entry.reversedByNumber}`].filter(Boolean).join(" | ");
}
