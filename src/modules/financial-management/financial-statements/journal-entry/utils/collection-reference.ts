import type { JournalEntryGroup } from "../types";

/** Collection document numbers come from the source reference, never from the JE label. */
export function collectionReference(group: JournalEntryGroup): string | null {
  if (group.sourceModule?.trim().toLowerCase() !== "collection") return null;
  const references = new Set(group.entries.map(entry => entry.transactionRef?.trim()).filter((value): value is string => Boolean(value)));
  return references.size === 1 ? references.values().next().value! : null;
}
