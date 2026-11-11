import { DirectusError, listItems } from "./directus";
import { listGlMapping } from "./gl.service";

const ENTRIES = "bank_journal_entries";

/** Directus answers 403 for an item this token cannot see and 404 once it is gone. */
export function isMissingItem(error: unknown): boolean {
  return error instanceof DirectusError && (error.status === 403 || error.status === 404);
}

/**
 * Every key this instance has not mapped, for the rows that still need an entry. An unreadable
 * table is reported as empty: the post route refuses with the keys instead of guessing.
 */
export async function unmappedKeys(): Promise<Set<string>> {
  try {
    const mapping = await listGlMapping();
    return new Set(
      mapping.filter((row) => !("coaId" in row && row.coaId)).map((row) => row.mappingKey.toUpperCase()),
    );
  } catch {
    return new Set();
  }
}

/**
 * The journal number a source ref and event code already hold. The unique index on those two
 * columns is what makes a repost idempotent, so the caller reports this instead of inserting.
 */
export async function findSourceEntry(sourceRef: string, eventCode: string): Promise<string | null> {
  const { rows } = await listItems<{ je_no: string }>(ENTRIES, {
    fields: ["je_no"],
    filter: { _and: [{ source_ref: { _eq: sourceRef } }, { event_code: { _eq: eventCode } }] },
    limit: 1,
  });
  if (!rows.length) return null;
  const jeNo = rows[0]?.je_no;
  return jeNo ? String(jeNo) : "an unnumbered journal entry";
}
