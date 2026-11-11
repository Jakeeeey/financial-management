import "server-only";

import type {
  GlMappingRow,
  JournalEntryDraft,
  PostedJournalEntry,
  ResolvedJournalEntry,
  ResolvedJournalLine,
} from "../types";
import { phtStamp } from "../pht";
import { createItem, directusFetch, listItems, roundMoney } from "./directus";

/**
 * Resolves E02–E06 posting rules and records them.
 *
 * No line is ever built from a literal GL code: every line names a mapping key and the key
 * resolves to a real `coa_id` from `bank_gl_mapping`, or to `COA:<coa_id>` for an account the
 * user picked. While a key is empty the entry stays unresolvable and posting refuses, which is
 * the "ask accounting to map it" state instead of inventing accounts.
 */

const MAPPING = "bank_gl_mapping";
const ENTRIES = "bank_journal_entries";
const LINES = "bank_journal_lines";
const COA = "chart_of_accounts";

type CoaRow = { coa_id: number; gl_code: string | null; account_title: string | null };

const MAPPING_FIELDS = ["mapping_key", "coa_id", "updated_at"];
const COA_FIELDS = ["coa_id", "gl_code", "account_title"];

/** Stored stamps are PHT wall clock: `YYYY-MM-DD HH:mm:ss`. */
function phtNow(): string {
  return phtStamp().replace("T", " ");
}

/** Every mapping key with the account it currently resolves to. */
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

/** Turns mapping keys into real accounts, reporting any key that has none yet. */
export async function resolveJournalEntry(draft: JournalEntryDraft): Promise<ResolvedJournalEntry> {
  const [mapping, accounts] = await Promise.all([listGlMapping(), listCoa()]);
  const byKey = new Map(mapping.map((row) => [row.mappingKey.toUpperCase(), row]));
  const byCoaId = new Map(accounts.map((account) => [String(account.coa_id), account]));
  const missing = new Set<string>();

  const lines: ResolvedJournalLine[] = draft.lines.map((line, index) => {
    const key = line.mappingKey.toUpperCase();

    // `COA:<id>` pins a line to an explicit account (reversals, expense picks);
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

/**
 * Whether settling a transfer can post at all, so the listing can say so before a click
 * fails. An unreadable mapping table is reported as ready: the settle route still guards it.
 */
export async function transferMappingState(): Promise<string[]> {
  try {
    const mapping = await listGlMapping();
    const row = mapping.find((entry) => entry.mappingKey.toUpperCase() === "TRANSFER_IN_TRANSIT");
    return row && "coaId" in row && row.coaId ? [] : ["TRANSFER_IN_TRANSIT"];
  } catch {
    return [];
  }
}

/** Raised when a posting cannot proceed; the route turns it into a 409 with the keys. */export class PostingBlockedError extends Error {
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

/** Writes one balanced entry and its lines, and returns it with its journal number. */
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
  const { rows: headers } = await listItems<{
    id: number;
    je_no: string;
    event_code: string;
    source_module: string;
    source_ref: string | null;
    posting_date: string;
    description: string | null;
    status: string;
  }>(ENTRIES, {
    fields: ["id", "je_no", "event_code", "source_module", "source_ref", "posting_date", "description", "status"],
    filter: { je_no: { _eq: jeNo } },
    limit: 1,
  });
  const header = headers[0];
  if (!header) throw new PostingBlockedError(`Journal entry ${jeNo} not found.`);
  if (header.status === "REVERSED") throw new PostingBlockedError(`Journal entry ${jeNo} is already reversed.`);

  const { rows: lines } = await listItems<{
    line_no: number;
    coa_id: number | null;
    debit: number;
    credit: number;
    memo: string | null;
  }>(LINES, {
    fields: ["line_no", "coa_id", "debit", "credit", "memo"],
    filter: { journal_entry_id: { _eq: header.id } },
    sort: "line_no",
    limit: 200,
  });
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

/**
 * One posted entry with its lines, for the read-only ledger view. Returns null instead
 * of throwing when the number does not exist, so the caller can say so plainly.
 */
export async function fetchJournalEntry(jeNo: string): Promise<PostedJournalEntry | null> {
  const { rows: headers } = await listItems<Record<string, unknown>>(ENTRIES, {
    fields: [
      "id",
      "je_no",
      "event_code",
      "source_module",
      "source_ref",
      "posting_date",
      "description",
      "status",
      "reverses_je_no",
      "total_debit",
      "total_credit",
      "created_at",
    ],
    filter: { je_no: { _eq: jeNo } },
    limit: 1,
  });
  const header = headers[0];
  if (!header) return null;

  const { rows: lines } = await listItems<Record<string, unknown>>(LINES, {
    fields: ["line_no", "coa_id", "gl_code", "account_title", "debit", "credit", "memo"],
    filter: { journal_entry_id: { _eq: Number(header.id) } },
    sort: "line_no",
    limit: 200,
  });

  return {
    id: Number(header.id),
    jeNo: String(header.je_no),
    eventCode: String(header.event_code),
    sourceModule: String(header.source_module),
    sourceRef: header.source_ref == null ? "" : String(header.source_ref),
    postingDate: String(header.posting_date),
    description: header.description == null ? "" : String(header.description),
    status: String(header.status) === "REVERSED" ? "REVERSED" : "POSTED",
    reversesJeNo: header.reverses_je_no == null ? null : String(header.reverses_je_no),
    createdAt: String(header.created_at ?? ""),
    totalDebit: roundMoney(Number(header.total_debit) || 0),
    totalCredit: roundMoney(Number(header.total_credit) || 0),
    missingMappingKeys: [],
    lines: lines.map((line) => ({
      lineNo: Number(line.line_no) || 0,
      coaId: line.coa_id == null ? null : Number(line.coa_id),
      glCode: line.gl_code == null ? null : String(line.gl_code),
      accountTitle: line.account_title == null ? null : String(line.account_title),
      debit: roundMoney(Number(line.debit) || 0),
      credit: roundMoney(Number(line.credit) || 0),
      memo: line.memo == null ? null : String(line.memo),
    })),
  };
}
