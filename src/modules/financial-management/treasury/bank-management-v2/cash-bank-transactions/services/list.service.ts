import "server-only";

import { PAGE_SIZE } from "../constants";
import type { TransactionFilters, TransactionKind, TransactionRow, TransactionsPayload } from "../types";
import { listAccounts, listExpenseAccounts, toAccountOption } from "./accounts.service";
import { asNumber, asString, DirectusError, listItems } from "./directus";
import { transferMappingState } from "./gl.service";

/**
 * The combined Cash & Bank Transactions list.
 *
 * `bank_memos` and `bank_transfers` are separate collections with different columns, so the
 * lane reads both, flattens them to one row shape, sorts newest first and slices the page in
 * memory. Every read degrades to an empty list when a collection or a V2 column is missing:
 * the owner applies the DDL after this ships.
 */

const MEMO_FIELDS = [
  "id",
  "ref_no",
  "bank_account_id",
  "memo_type",
  "amount",
  "value_date",
  "description",
  "status",
  "journal_entry_id",
];

const TRANSFER_FIELDS = [
  "transfer_id",
  "transfer_no",
  "transfer_date",
  "value_date",
  "source_bank_id",
  "destination_bank_id",
  "amount",
  "transfer_fee",
  "status",
  "settled_at",
  "remarks",
  "journal_entry_id",
];

/** Before the V2 alters: no value_date, settled_at or journal_entry_id. */
const TRANSFER_LEGACY_FIELDS = [
  "transfer_id",
  "transfer_no",
  "transfer_date",
  "source_bank_id",
  "destination_bank_id",
  "amount",
  "transfer_fee",
  "status",
  "remarks",
];

const JE_FIELDS = ["id", "je_no"];
const MEMO_LIMIT = 1000;
const TRANSFER_LIMIT = 1000;
const CLEARING_LIMIT = 100;

type RawRow = Record<string, unknown>;

/** A row plus the journal-entry id that has not been resolved to a JE number yet. */
type MappedRow = { row: TransactionRow; journalEntryId: number | null };

type ReadResult = { rows: MappedRow[]; total: number };

/** Builds the page: accounts, expense accounts, both collections, the clearing panel. */
export async function listTransactions(filters: TransactionFilters): Promise<TransactionsPayload> {
  const notices: string[] = [];
  const accountResult = await listAccounts();
  if (accountResult.notice) notices.push(accountResult.notice);
  const labels = new Map(accountResult.accounts.map((account) => [account.bankId, account.label]));

  const expenseAccounts = await readExpenseAccounts(notices);
  // The register filters by bank before account, so a bank choice narrows the collection query.
  const bankIds = filters.bankName
    ? accountResult.accounts.filter((account) => account.bankName === filters.bankName).map((account) => account.bankId)
    : null;
  const memoResult =
    filters.kind === "TRANSFER" ? { rows: [], total: 0 } : await readMemos(filters, labels, bankIds, notices);
  const transferResult = await readTransfers(filters, labels, bankIds, notices);
  const clearing = await readPendingTransfers(labels, notices);
  const mappingMissing = clearing.length > 0 ? await transferMappingState() : [];

  const merged = [...memoResult.rows, ...transferResult.rows].sort((a, b) => {
    if (a.row.date !== b.row.date) return a.row.date < b.row.date ? 1 : -1;
    return b.row.id - a.row.id;
  });

  const page = Math.max(1, filters.page);
  const slice = merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  await resolveJeNumbers([...slice, ...clearing]);

  return {
    rows: slice.map((entry) => entry.row),
    page,
    pageSize: PAGE_SIZE,
    total: memoResult.total + transferResult.total,
    accounts: accountResult.accounts.map(toAccountOption),
    expenseAccounts,
    clearing: clearing.map((entry) => entry.row),
    mappingMissing,
    kinds: [...new Set(merged.map((entry) => entry.row.kind))],
    notice: notices.length ? [...new Set(notices)].join(" ") : null,
  };
}

async function readExpenseAccounts(notices: string[]) {
  try {
    return await listExpenseAccounts();
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    notices.push("The chart of accounts could not be read, so debit memos cannot pick an expense account yet.");
    return [];
  }
}

async function readMemos(
  filters: TransactionFilters,
  labels: Map<number, string>,
  bankIds: number[] | null,
  notices: string[],
): Promise<ReadResult> {
  try {
    const { rows, total } = await listItems<RawRow>("bank_memos", {
      fields: MEMO_FIELDS,
      filter: memoFilter(filters, bankIds),
      sort: "-value_date,-id",
      limit: MEMO_LIMIT,
    });
    return { rows: rows.map((row) => mapMemo(row, labels)), total };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    notices.push("Credit, debit and interest memos are not available yet: the memo table has not been created.");
    return { rows: [], total: 0 };
  }
}

async function readTransfers(
  filters: TransactionFilters,
  labels: Map<number, string>,
  bankIds: number[] | null,
  notices: string[],
): Promise<ReadResult> {
  if (filters.kind !== "ALL" && filters.kind !== "TRANSFER") return { rows: [], total: 0 };

  try {
    const { rows, total } = await listItems<RawRow>("bank_transfers", {
      fields: TRANSFER_FIELDS,
      filter: transferFilter(filters, "value_date", bankIds),
      sort: "-value_date,-transfer_id",
      limit: TRANSFER_LIMIT,
    });
    return { rows: rows.map((row) => mapTransfer(row, labels)), total };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
  }

  try {
    const { rows, total } = await listItems<RawRow>("bank_transfers", {
      fields: TRANSFER_LEGACY_FIELDS,
      filter: transferFilter(filters, "transfer_date", bankIds),
      sort: "-transfer_date,-transfer_id",
      limit: TRANSFER_LIMIT,
    });
    notices.push("Transfers do not store a value date yet, so the transfer date is shown instead.");
    return { rows: rows.map((row) => mapTransfer(row, labels)), total };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    notices.push("Fund transfers are not available yet.");
    return { rows: [], total: 0 };
  }
}

/** PENDING transfers still sitting in transfer-in-transit, oldest value date first. */
async function readPendingTransfers(labels: Map<number, string>, notices: string[]): Promise<MappedRow[]> {
  try {
    const { rows } = await listItems<RawRow>("bank_transfers", {
      fields: TRANSFER_FIELDS,
      filter: { status: { _eq: "PENDING" } },
      sort: "value_date",
      limit: CLEARING_LIMIT,
    });
    return rows.map((row) => mapTransfer(row, labels));
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
  }

  try {
    const { rows } = await listItems<RawRow>("bank_transfers", {
      fields: TRANSFER_LEGACY_FIELDS,
      filter: { status: { _eq: "PENDING" } },
      sort: "transfer_date",
      limit: CLEARING_LIMIT,
    });
    return rows.map((row) => mapTransfer(row, labels));
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    notices.push("Transfers in clearing could not be read.");
    return [];
  }
}

function memoFilter(filters: TransactionFilters, bankIds: number[] | null): Record<string, unknown> | undefined {
  const and: Record<string, unknown>[] = [];
  if (filters.kind !== "ALL" && filters.kind !== "TRANSFER") and.push({ memo_type: { _eq: filters.kind } });
  if (bankIds) and.push({ bank_account_id: { _in: bankIds } });
  if (filters.bankAccountId) and.push({ bank_account_id: { _eq: filters.bankAccountId } });
  if (filters.status) and.push({ status: { _eq: filters.status } });
  if (filters.from) and.push({ value_date: { _gte: filters.from } });
  if (filters.to) and.push({ value_date: { _lte: filters.to } });
  if (filters.q) {
    and.push({ _or: [{ ref_no: { _contains: filters.q } }, { description: { _contains: filters.q } }] });
  }
  return and.length ? { _and: and } : undefined;
}

function transferFilter(
  filters: TransactionFilters,
  dateField: string,
  bankIds: number[] | null,
): Record<string, unknown> | undefined {
  const and: Record<string, unknown>[] = [];
  if (bankIds) {
    and.push({
      _or: [{ source_bank_id: { _in: bankIds } }, { destination_bank_id: { _in: bankIds } }],
    });
  }
  if (filters.bankAccountId) {
    and.push({
      _or: [
        { source_bank_id: { _eq: filters.bankAccountId } },
        { destination_bank_id: { _eq: filters.bankAccountId } },
      ],
    });
  }
  if (filters.status) and.push({ status: { _eq: filters.status } });
  if (filters.from) and.push({ [dateField]: { _gte: filters.from } });
  if (filters.to) and.push({ [dateField]: { _lte: filters.to } });
  if (filters.q) {
    and.push({ _or: [{ transfer_no: { _contains: filters.q } }, { remarks: { _contains: filters.q } }] });
  }
  return and.length ? { _and: and } : undefined;
}

function mapMemo(raw: RawRow, labels: Map<number, string>): MappedRow {
  const stored = asString(raw.memo_type).toUpperCase();
  const kind: TransactionKind = stored === "DEBIT" ? "DEBIT" : stored === "INTEREST" ? "INTEREST" : "CREDIT";
  const valueDate = asString(raw.value_date);
  const bankId = asNumber(raw.bank_account_id);

  return {
    journalEntryId: asNumber(raw.journal_entry_id) || null,
    row: {
      key: `memo-${asNumber(raw.id)}`,
      id: asNumber(raw.id),
      kind,
      refNo: asString(raw.ref_no),
      date: valueDate,
      valueDate,
      accountLabel: labels.get(bankId) ?? "Bank account",
      counterpartLabel: null,
      amount: asNumber(raw.amount),
      fee: 0,
      direction: kind === "DEBIT" ? "OUT" : "IN",
      status: asString(raw.status).toUpperCase() || "POSTED",
      jeNo: null,
      description: asString(raw.description) || null,
    },
  };
}

function mapTransfer(raw: RawRow, labels: Map<number, string>): MappedRow {
  const sourceId = asNumber(raw.source_bank_id);
  const destinationId = asNumber(raw.destination_bank_id);
  const valueDate = asString(raw.value_date) || asString(raw.transfer_date);

  return {
    journalEntryId: asNumber(raw.journal_entry_id) || null,
    row: {
      key: `transfer-${asNumber(raw.transfer_id)}`,
      id: asNumber(raw.transfer_id),
      kind: "TRANSFER",
      refNo: asString(raw.transfer_no),
      date: valueDate,
      valueDate,
      accountLabel: labels.get(sourceId) ?? "Bank account",
      counterpartLabel: labels.get(destinationId) ?? "Bank account",
      amount: asNumber(raw.amount),
      fee: asNumber(raw.transfer_fee),
      direction: "OUT",
      status: asString(raw.status).toUpperCase() || "PREPARED",
      jeNo: null,
      description: asString(raw.remarks) || null,
    },
  };
}

/** Replaces the stored journal-entry ids with the entry numbers the list shows. */
async function resolveJeNumbers(rows: MappedRow[]): Promise<void> {
  const ids = [...new Set(rows.map((entry) => entry.journalEntryId).filter((id): id is number => id !== null))];
  if (!ids.length) return;

  try {
    const { rows: entries } = await listItems<{ id: number; je_no: string }>("bank_journal_entries", {
      fields: JE_FIELDS,
      filter: { id: { _in: ids } },
      limit: ids.length,
    });
    const byId = new Map(entries.map((entry) => [asNumber(entry.id), asString(entry.je_no)]));
    for (const entry of rows) {
      if (entry.journalEntryId !== null) entry.row.jeNo = byId.get(entry.journalEntryId) ?? null;
    }
  } catch (error) {
    // A missing number only costs the JE column, not the page.
    if (!(error instanceof DirectusError)) throw error;
    console.warn(`[cash-bank-transactions] journal numbers unavailable: ${error.status}`);
  }
}
