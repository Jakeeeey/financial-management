import type { PostingEntry } from "../posting-types";
import { centsAmount, transactionCents, transactionMoney } from "./transactionDisplay";

export type BatchStatusCounts = {
  ready: number;
  needsAccount: number;
  exported: number;
  pending: number;
  failed: number;
  history: number;
};

const HISTORY_STATUSES: PostingEntry["status"][] = ["POSTED", "REVERSED", "REVERSAL", "WITHDRAWN", "SUPERSEDED"];

/** Mirrors the bulk action predicate so the panel count always equals what posts. */
export function readyEntries(entries: PostingEntry[]): PostingEntry[] {
  return entries.filter(entry => entry.canPost === true);
}

export function batchCashEffect(entries: PostingEntry[]): bigint {
  return readyEntries(entries).reduce((total, entry) => total + entry.lines.reduce(
    (sum, line) => line.role === "CASH" ? sum + transactionCents(line.debit) - transactionCents(line.credit) : sum,
    0n,
  ), 0n);
}

export function batchStatusCounts(entries: PostingEntry[]): BatchStatusCounts {
  const counts: BatchStatusCounts = { ready: 0, needsAccount: 0, exported: 0, pending: 0, failed: 0, history: 0 };
  for (const entry of entries) {
    if (entry.canPost === true) counts.ready++;
    if (entry.status === "NEEDS_ACCOUNT") counts.needsAccount++;
    else if (entry.status === "EXPORTED") counts.exported++;
    else if (entry.status === "PENDING") counts.pending++;
    else if (entry.status === "FAILED") counts.failed++;
    else if (HISTORY_STATUSES.includes(entry.status)) counts.history++;
  }
  return counts;
}

export function formatBatchCashEffect(cents: bigint, currency: string): string {
  const amount = centsAmount(cents);
  return cents > 0n ? `+${transactionMoney(amount, currency)}` : transactionMoney(amount, currency);
}
