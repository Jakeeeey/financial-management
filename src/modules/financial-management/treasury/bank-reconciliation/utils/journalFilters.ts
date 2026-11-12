import type { PostingEntry } from "../posting-types";

export const JOURNAL_STATUSES: { value: PostingEntry["status"]; label: string }[] = [
  { value: "NEEDS_ACCOUNT", label: "Needs account" }, { value: "READY", label: "Ready" },
  { value: "PENDING", label: "Pending GL" }, { value: "EXPORTED", label: "Exported" },
  { value: "FAILED", label: "Failed" }, { value: "POSTED", label: "Posted" },
  { value: "REVERSED", label: "Reversed" }, { value: "REVERSAL", label: "Reversal" },
  { value: "WITHDRAWN", label: "Withdrawn" }, { value: "SUPERSEDED", label: "Superseded" },
];
export type JournalStatusFilter = "ALL" | PostingEntry["status"];

export function matchesJournal(entry: PostingEntry, search: string, status: JournalStatusFilter) {
  if (status !== "ALL" && entry.status !== status) return false;
  const text = [entry.workbenchNumber, entry.journalNumber, entry.importReference, entry.sourceLabel, entry.explanation].filter(Boolean).join(" ").toLowerCase();
  return search.trim().toLowerCase().split(/\s+/).filter(Boolean).every(token => text.includes(token));
}
