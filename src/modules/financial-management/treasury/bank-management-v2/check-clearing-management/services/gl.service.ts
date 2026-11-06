import "server-only";

import type {
  GlMappingRow,
  JournalEntryDraft,
  PostedJournalEntry,
  ResolvedJournalEntry,
  ResolvedJournalLine,
} from "../types";
import { createItem, directusFetch, listItems, queryString, roundMoney } from "./directus";

/**
 * Resolves E01–E15 posting rules and records them.
 *
 * The FSD's GL codes (101100, 102100, 232100 …) do not exist in `chart_of_accounts`,
 * so no line is ever built from a literal code: every line names a mapping key and the
 * key resolves to a real `coa_id` from `bank_gl_mapping`. While a key is empty the entry
 * is returned unresolvable and posting refuses, which is the "configure mapping" state
 * the owner asked for instead of inventing accounts.
 */

const MAPPING = "bank_gl_mapping";
const ENTRIES = "bank_journal_entries";
const LINES = "bank_journal_lines";
const COA = "chart_of_accounts";

type CoaRow = { coa_id: number; gl_code: string | null; account_title: string | null };

const MAPPING_FIELDS = ["mapping_key", "coa_id", "updated_at"];
const COA_FIELDS = ["coa_id", "gl_code", "account_title"];

export async function listGlMapping(): Promise<GlMappingRow[]> {
  const [{ rows: mappings }, accounts] = await Promise.all([
    listItems<{ mapping_key: string; coa_id: number | null; updated_at: string | null }>(MAPPING, {
      fields: MAPPING_FIELDS,
      limit: 200,
    }),
    listCoa(),
  ]);

  const byId = new Map(accounts.map((account) => [Number(account.coa_id), account]));
  return mappings
    .map((row) => {
      const account = row.coa_id == null ? null : byId.get(Number(row.coa_id)) ?? null;
      return {
        mappingKey: row.mapping_key,
        coaId: row.coa_id == null ? null : Number(row.coa_id),
        glCode: account?.gl_code ?? null,
        accountTitle: account?.account_title ?? null,
        updatedAt: row.updated_at,
      };
    })
    .sort((a, b) => a.mappingKey.localeCompare(b.mappingKey));
}

async function listCoa(): Promise<CoaRow[]> {
  const { rows } = await listItems<CoaRow>(COA, { fields: COA_FIELDS, limit: 500 });
  return rows;
}

export async function saveGlMapping(
  updates: Array<{ mappingKey: string; coaId: number | null }>,
  userId: number | null,
): Promise<GlMappingRow[]> {
  const nowPht = phtNow();
  for (const update of updates) {
    const response = await directusFetch<{ data?: unknown[] }>(
      `/items/${MAPPING}${queryString({ filter: JSON.stringify({ mapping_key: { _eq: update.mappingKey } }) })}`,
      { method: "PATCH", body: JSON.stringify({ coa_id: update.coaId, updated_by_user_id: userId, updated_at: nowPht }) },
    );
    if (!response.data?.length) {
      await createItem(MAPPING, {
        mapping_key: update.mappingKey,
        coa_id: update.coaId,
        updated_by_user_id: userId,
        updated_at: nowPht,
      });
    }
  }
  return listGlMapping();
}

function phtNow(): string {
  // Kept local to avoid importing the client-safe helper into a server-only module's
  // dependency chain twice; the format is identical to shared/pht.ts phtStamp().
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  return shifted.slice(0, 19).replace("T", " ");
}

export async function resolveJournalEntry(draft: JournalEntryDraft): Promise<ResolvedJournalEntry> {
  const [mapping, accounts] = await Promise.all([listGlMapping(), listCoa()]);
  const byKey = new Map(mapping.map((row) => [row.mappingKey.toUpperCase(), row]));
  const byCoaId = new Map(accounts.map((account) => [String(account.coa_id), account]));
  const missing = new Set<string>();

  const lines: ResolvedJournalLine[] = draft.lines.map((line, index) => {
    const key = line.mappingKey.toUpperCase();

    // `COA:<id>` pins a line to an explicit account (reversals, direct expense picks);
    // everything else must come from the mapping table.
    const pinned = key.startsWith("COA:") ? byCoaId.get(key.slice(4)) : undefined;
    const mapped = pinned ?? byKey.get(key);
    if (!mapped || (pinned ? false : !("coaId" in mapped && mapped.coaId))) missing.add(key);

    return {
      lineNo: index + 1,
      coaId: pinned ? Number(pinned.coa_id) : (mapped as GlMappingRow | undefined)?.coaId ?? null,
      glCode: pinned ? pinned.gl_code : (mapped as GlMappingRow | undefined)?.glCode ?? null,
      accountTitle: pinned ? pinned.account_title : (mapped as GlMappingRow | undefined)?.accountTitle ?? null,
      debit: roundMoney(line.debit || 0),
      credit: roundMoney(line.credit || 0),
      memo: line.memo ?? null,
    };
  });

  return {
    eventCode: draft.eventCode,
    sourceModule: draft.sourceModule,
    sourceRef: draft.sourceRef,
    postingDate: draft.postingDate,
    description: draft.description,
    lines,
    totalDebit: roundMoney(lines.reduce((sum, line) => sum + line.debit, 0)),
    totalCredit: roundMoney(lines.reduce((sum, line) => sum + line.credit, 0)),
    missingMappingKeys: [...missing],
  };
}

export class PostingBlockedError extends Error {
  missingMappingKeys: string[];

  constructor(message: string, missingMappingKeys: string[] = []) {
    super(message);
    this.name = "PostingBlockedError";
    this.missingMappingKeys = missingMappingKeys;
  }
}

async function nextJeNo(): Promise<string> {
  const { rows } = await listItems<{ id: number }>(ENTRIES, { fields: ["id"], sort: "-id", limit: 1 });
  const next = Number(rows[0]?.id ?? 0) + 1;
  return `JE-${String(next).padStart(7, "0")}`;
}

export async function postJournalEntry(
  draft: JournalEntryDraft,
  userId: number | null = null,
  reversesJeNo: string | null = null,
): Promise<PostedJournalEntry> {
  const resolved = await resolveJournalEntry(draft);

  if (resolved.missingMappingKeys.length > 0) {
    throw new PostingBlockedError(
      "GL mapping incomplete: configure the missing account mappings before posting.",
      resolved.missingMappingKeys,
    );
  }
  if (resolved.totalDebit <= 0 || resolved.totalDebit !== resolved.totalCredit) {
    throw new PostingBlockedError("Journal entry does not balance.");
  }

  const jeNo = await nextJeNo();
  const created = await createItem<{ id: number; je_no: string; created_at: string }>(ENTRIES, {
    je_no: jeNo,
    event_code: resolved.eventCode,
    source_module: resolved.sourceModule,
    source_ref: resolved.sourceRef,
    posting_date: resolved.postingDate,
    description: resolved.description,
    total_debit: resolved.totalDebit,
    total_credit: resolved.totalCredit,
    status: "POSTED",
    reverses_je_no: reversesJeNo,
    created_by: userId,
    created_at: phtNow(),
  });

  try {
    for (const line of resolved.lines) {
      await createItem(LINES, {
        journal_entry_id: created.id,
        line_no: line.lineNo,
        coa_id: line.coaId,
        gl_code: line.glCode,
        account_title: line.accountTitle,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo,
      });
    }
  } catch (error) {
    // The REST API has no cross-collection transaction; drop the orphan header so a
    // half-written entry cannot appear in the ledger.
    await directusFetch(`/items/${ENTRIES}/${created.id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }

  return {
    ...resolved,
    id: created.id,
    jeNo: created.je_no,
    status: "POSTED",
    reversesJeNo,
    createdAt: created.created_at,
  };
}

/** Mirrors an existing entry: debits become credits, credits become debits. */
export async function reverseJournalEntry(jeNo: string, userId: number | null = null): Promise<PostedJournalEntry> {
  const { rows: headers } = await listItems<{ id: number; je_no: string; event_code: string; source_module: string; source_ref: string | null; posting_date: string; description: string | null; status: string }>(
    ENTRIES,
    { fields: ["id", "je_no", "event_code", "source_module", "source_ref", "posting_date", "description", "status"], filter: { je_no: { _eq: jeNo } }, limit: 1 },
  );
  const header = headers[0];
  if (!header) throw new PostingBlockedError(`Journal entry ${jeNo} not found.`);
  if (header.status === "REVERSED") throw new PostingBlockedError(`Journal entry ${jeNo} is already reversed.`);

  const { rows: lines } = await listItems<{ line_no: number; coa_id: number | null; debit: number; credit: number; memo: string | null }>(
    LINES,
    { fields: ["line_no", "coa_id", "debit", "credit", "memo"], filter: { journal_entry_id: { _eq: header.id } }, sort: "line_no", limit: 200 },
  );
  if (!lines.length) throw new PostingBlockedError(`Journal entry ${jeNo} has no lines.`);

  const reversal = await postJournalEntry(
    {
      eventCode: header.event_code,
      sourceModule: header.source_module,
      sourceRef: header.source_ref ?? "",
      postingDate: header.posting_date,
      description: `Reversal of ${jeNo}${header.description ? ` — ${header.description}` : ""}`,
      lines: lines.map((line) => ({
        mappingKey: `COA:${line.coa_id}`,
        debit: roundMoney(Number(line.credit) || 0),
        credit: roundMoney(Number(line.debit) || 0),
        memo: line.memo ?? undefined,
      })),
    },
    userId,
    jeNo,
  );

  await directusFetch(`/items/${ENTRIES}/${header.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "REVERSED" }),
  });

  return reversal;
}
