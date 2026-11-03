import type { JournalEntryGroup } from "../types";

export const EXPORT_BATCH_SIZE = 500;

function isGroup(value: unknown): value is JournalEntryGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as JournalEntryGroup;
  return Number.isSafeInteger(group.jeGroupCounter)
    && typeof group.jeNo === "string" && typeof group.sourceModule === "string"
    && (group.transactionDate == null || typeof group.transactionDate === "string")
    && Array.isArray(group.entries) && group.entries.length > 0
    && group.entries.every(entry => entry && Number.isFinite(entry.debit) && Number.isFinite(entry.credit));
}

/** Load complete journals on the server, rejecting partial or inconsistent results. */
export async function loadJournalExportGroups(
  fetchPage: (page: number, pageSize: number) => Promise<unknown>,
  signal: AbortSignal,
): Promise<JournalEntryGroup[]> {
  const groups: JournalEntryGroup[] = [];
  const identities = new Set<string>();
  let expectedTotal: number | undefined;
  let expectedPages = 1;
  for (let page = 0; page < expectedPages; page++) {
    signal.throwIfAborted();
    const payload = await fetchPage(page, EXPORT_BATCH_SIZE) as {
      data?: unknown[];
      metadata?: { totalGroups: number; totalPages: number; currentPage?: number; pageSize?: number };
    } | null;
    signal.throwIfAborted();
    const metadata = payload?.metadata;
    if (!Array.isArray(payload?.data) || !metadata
      || !Number.isSafeInteger(metadata.totalGroups) || metadata.totalGroups < 0
      || !Number.isSafeInteger(metadata.totalPages) || metadata.totalPages < 0
      || metadata.totalPages !== Math.ceil(metadata.totalGroups / EXPORT_BATCH_SIZE)
      || (metadata.currentPage !== undefined && metadata.currentPage !== page)
      || (metadata.pageSize !== undefined && metadata.pageSize !== EXPORT_BATCH_SIZE)) {
      throw new Error("The export response was incomplete. Please retry.");
    }
    if (expectedTotal === undefined) {
      expectedTotal = metadata.totalGroups;
      expectedPages = metadata.totalPages;
    } else if (metadata.totalGroups !== expectedTotal || metadata.totalPages !== expectedPages) {
      throw new Error("Journal results changed during export. Please retry.");
    }
    if (payload.data.length !== Math.min(EXPORT_BATCH_SIZE, expectedTotal - page * EXPORT_BATCH_SIZE)) {
      throw new Error("The export did not include all matching journals. Please retry.");
    }
    for (const group of payload.data) {
      if (!isGroup(group)) throw new Error("The export contained invalid journal data. Please retry.");
      const identity = JSON.stringify([group.jeGroupCounter, group.jeNo, group.transactionDate, group.sourceModule]);
      if (identities.has(identity)) throw new Error("Journal results changed during export. Please retry.");
      identities.add(identity);
      groups.push(group);
    }
  }
  if (groups.length !== expectedTotal) throw new Error("The export did not include all matching journals. Please retry.");
  return groups;
}
