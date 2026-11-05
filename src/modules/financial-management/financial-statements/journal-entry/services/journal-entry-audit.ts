import { adjustingJournalEntriesApi } from "../../adjusting-journal-entries/services/adjusting-journal-entries.api";
import type { AjeAuditEvent } from "../../adjusting-journal-entries/types";

export async function getJournalAuditEvents(journalNumber: string, signal?: AbortSignal): Promise<AjeAuditEvent[]> {
  const events: AjeAuditEvent[] = [];
  const params = new URLSearchParams({ search: journalNumber, size: "100" });
  let totalPages = 1;
  for (let page = 0; page < totalPages; page += 1) {
    params.set("page", String(page));
    const result = await adjustingJournalEntriesApi.audit(params, signal);
    events.push(...result.content.filter(event => event.journalNumber === journalNumber));
    totalPages = result.totalPages;
  }
  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id - b.id);
}
