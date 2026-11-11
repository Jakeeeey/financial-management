import "server-only";

import { CHECK_RETURN_REASONS, CHECK_STATUS_LABELS, STALE_CHECK_DAYS } from "../constants";
import { issuedCheckEntry, receivedCheckEntry } from "../events";
import { daysSince, phtStamp, phtToday, toPhtDateString } from "../pht";
import type {
  BankCheck,
  CheckDirection,
  CheckEvent,
  CheckStatus,
  CheckbookSeries,
  JournalEntryDraft,
} from "../types";
import {
  DirectusError,
  asBoolean,
  asNumber,
  asString,
  createItem,
  getItem,
  listItems,
  roundMoney,
  updateItem,
} from "./directus";
import { PostingBlockedError, postJournalEntry } from "./gl.service";

/**
 * Check & Clearing management: issuing, receiving and the clearing trail.
 *
 * `bank_checks`, `bank_check_events` and `bank_checkbooks` come from DDL the owner runs
 * separately, so every read tolerates the tables being absent and reports a notice
 * instead of failing the screen. Fields are always enumerated: this instance rejects
 * `fields=*`.
 */

const CHECKS = "bank_checks";
const EVENTS = "bank_check_events";
const CHECKBOOKS = "bank_checkbooks";
const ACCOUNTS = "bank_accounts";
const JOURNALS = "bank_journal_entries";

const NOTICE_REGISTER = "The check register table has not been created yet.";
const NOTICE_CHECKBOOKS = "The checkbook series table has not been created yet.";

const CHECK_FIELDS = [
  "id",
  "bank_account_id",
  "direction",
  "check_no",
  "check_date",
  "amount",
  "drawee_bank",
  "payee",
  "payor",
  "control_key",
  "status",
  "is_pdc",
  "return_reason",
  "released_at",
  "deposited_at",
  "cleared_at",
  "returned_at",
  "replaced_by_id",
  "replaces_id",
  "source_type",
  "source_ref",
  "remarks",
  "created_at",
];

const EVENT_FIELDS = [
  "id",
  "check_id",
  "action",
  "from_status",
  "to_status",
  "event_code",
  "journal_entry_id",
  "note",
  "occurred_at",
];

const CHECKBOOK_FIELDS = [
  "id",
  "bank_account_id",
  "series_start",
  "series_end",
  "next_no",
  "is_active",
  "created_at",
];

const ACCOUNT_FIELDS = ["bank_id", "bank_name", "account_number"];

/** E09 debits the payee's control account: an issued check settles a payable. */
const ISSUED_COUNTER_KEY = "AP_CONTROL";

const CHECK_STATUSES = Object.keys(CHECK_STATUS_LABELS) as CheckStatus[];

type CheckRow = {
  id: number;
  bank_account_id: number | null;
  direction: string | null;
  check_no: string | null;
  check_date: string | null;
  amount: number | string | null;
  drawee_bank: string | null;
  payee: string | null;
  payor: string | null;
  control_key: string | null;
  status: string | null;
  is_pdc: unknown;
  return_reason: string | null;
  released_at: string | null;
  deposited_at: string | null;
  cleared_at: string | null;
  returned_at: string | null;
  replaced_by_id: number | null;
  replaces_id: number | null;
  source_type: string | null;
  source_ref: string | null;
  remarks: string | null;
  created_at: string | null;
};

type EventRow = {
  id: number;
  check_id: number | null;
  action: string | null;
  from_status: string | null;
  to_status: string | null;
  event_code: string | null;
  journal_entry_id: number | null;
  note: string | null;
  occurred_at: string | null;
};

type CheckbookRow = {
  id: number;
  bank_account_id: number | null;
  series_start: string | null;
  series_end: string | null;
  next_no: string | null;
  is_active: unknown;
  created_at: string | null;
};

type AccountRow = {
  bank_id: number;
  bank_name: string | null;
  account_number: string | null;
};

export type CheckAction = "RELEASE" | "DEPOSIT" | "CLEAR" | "RETURN" | "CANCEL" | "REPLACE";

export type PostingBlocked = { message: string; missingMappingKeys: string[] };

export type CheckWriteResult = {
  check: BankCheck;
  postingBlocked: PostingBlocked | null;
};

export type CheckRegisterFlag = "PDC" | "STALE" | "NOREPL" | "REPL";

export type CheckRegisterFilter = {
  direction?: CheckDirection;
  status?: CheckStatus;
  accountId?: number;
  bankName?: string;
  flag?: CheckRegisterFlag;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export type CheckRegisterResult = {
  checks: BankCheck[];
  counts: Record<CheckStatus, number>;
  accounts: { bankId: number; label: string; bankName: string }[];
  notice?: string;
};

export type CheckDetail = { check: BankCheck; events: CheckEvent[] };

export type CheckbookListResult = { series: CheckbookSeries[]; notice?: string };

export type IssueCheckInput = {
  bankAccountId: number;
  checkDate: string;
  amount: number;
  payee: string;
  remarks: string | null;
};

export type ReceiveCheckInput = {
  bankAccountId: number;
  checkNo: string;
  checkDate: string;
  amount: number;
  draweeBank: string | null;
  payor: string | null;
  remarks: string | null;
};

export type ReplacementInput = { checkDate: string; amount: number; checkNo?: string | null };

export type CheckActionInput = {
  action: CheckAction;
  returnReason?: string | null;
  note?: string | null;
  replacement?: ReplacementInput | null;
  /** Date the bank cleared the check. Defaults to today when omitted. */
  clearedDate?: string | null;
};

export type CreateCheckbookInput = {
  bankAccountId: number;
  seriesStart: string;
  seriesEnd: string;
};

export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/** A state conflict with the register: wrong status for the action, duplicate number, exhausted series. */
export class ConflictError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ConflictError";
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export type CheckErrorBody = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
  missingMappingKeys?: string[];
};

/** True for a real "YYYY-MM-DD" day; JS Date.parse would happily roll 2026-02-31 into March. */
export function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Maps a thrown error onto the API envelope. Logs every failure that is not a
 * caller mistake, so a 5xx never reaches the client without a server-side trace.
 */
export function describeCheckError(error: unknown, context: string): { status: number; body: CheckErrorBody } {
  if (error instanceof ConflictError) {
    console.error(context, error);
    return {
      status: 409,
      body: { success: false, error: error.message, ...(error.field ? { fieldErrors: { [error.field]: [error.message] } } : {}) },
    };
  }
  if (error instanceof NotFoundError) {
    console.error(context, error);
    return { status: 404, body: { success: false, error: error.message } };
  }
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { success: false, error: error.message, ...(error.field ? { fieldErrors: { [error.field]: [error.message] } } : {}) },
    };
  }
  console.error(context, error);
  if (error instanceof DirectusError) {
    return { status: 502, body: { success: false, error: "The banking instance rejected the request." } };
  }
  return { status: 500, body: { success: false, error: "The request could not be completed." } };
}

function accountLabel(row: AccountRow): string {
  return [row.bank_name, row.account_number].filter(Boolean).join(" · ") || `Account ${row.bank_id}`;
}

async function accountLabels(ids?: number[]): Promise<Map<number, string>> {
  const filter = ids && ids.length ? { bank_id: { _in: ids } } : undefined;
  const { rows } = await listItems<AccountRow>(ACCOUNTS, { fields: ACCOUNT_FIELDS, filter, limit: 500 });
  return new Map(rows.map((row) => [Number(row.bank_id), accountLabel(row)]));
}

async function listActiveAccounts(): Promise<{ bankId: number; label: string; bankName: string }[]> {
  const { rows } = await listItems<AccountRow>(ACCOUNTS, {
    fields: ACCOUNT_FIELDS,
    filter: { is_active: { _eq: true }, account_status: { _eq: "ACTIVE" } },
    sort: "bank_name",
    limit: 500,
  });
  return rows.map((row) => ({
    bankId: Number(row.bank_id),
    label: accountLabel(row),
    bankName: asString(row.bank_name) || "Bank account",
  }));
}

function checkStatus(value: unknown): CheckStatus {
  const status = asString(value).toUpperCase();
  return CHECK_STATUSES.find((candidate) => candidate === status) ?? "PENDING";
}

function checkDirection(value: unknown): CheckDirection {
  return asString(value).toUpperCase() === "RECEIVED" ? "RECEIVED" : "ISSUED";
}

function sourceType(value: unknown): BankCheck["sourceType"] {
  const type = asString(value).toUpperCase();
  return type === "COLLECTIONS" || type === "DISBURSEMENT" || type === "REPLACEMENT" ? type : "MANUAL";
}

function toCheck(row: CheckRow, labels: Map<number, string>, checkNos: Map<number, string> = new Map()): BankCheck {
  const status = checkStatus(row.status);
  const ageDays = daysSince(row.check_date);
  return {
    id: Number(row.id),
    bankAccountId: Number(row.bank_account_id ?? 0),
    bankAccountLabel: labels.get(Number(row.bank_account_id)) ?? "—",
    direction: checkDirection(row.direction),
    checkNo: asString(row.check_no),
    checkDate: toPhtDateString(row.check_date),
    amount: roundMoney(asNumber(row.amount)),
    draweeBank: row.drawee_bank,
    payee: row.payee,
    payor: row.payor,
    controlKey: row.control_key,
    status,
    isPdc: asBoolean(row.is_pdc),
    returnReason: row.return_reason,
    releasedAt: row.released_at ? toPhtDateString(row.released_at) : null,
    depositedAt: row.deposited_at ? toPhtDateString(row.deposited_at) : null,
    clearedAt: row.cleared_at ? toPhtDateString(row.cleared_at) : null,
    returnedAt: row.returned_at ? toPhtDateString(row.returned_at) : null,
    replacedById: row.replaced_by_id == null ? null : Number(row.replaced_by_id),
    replacesId: row.replaces_id == null ? null : Number(row.replaces_id),
    replacedByNo: row.replaced_by_id == null ? null : (checkNos.get(Number(row.replaced_by_id)) ?? null),
    replacesNo: row.replaces_id == null ? null : (checkNos.get(Number(row.replaces_id)) ?? null),
    sourceType: sourceType(row.source_type),
    sourceRef: row.source_ref,
    remarks: row.remarks,
    createdAt: toPhtDateString(row.created_at),
    ageDays,
    // FSD 1.4: a check still outstanding past the bank's 180-day window is stale.
    isStale:
      ageDays > STALE_CHECK_DAYS && (status === "PENDING" || status === "RECEIVED" || status === "IN_CLEARING"),
  };
}

function toSeries(row: CheckbookRow, labels: Map<number, string>): CheckbookSeries {
  const nextNo = asString(row.next_no);
  return {
    id: Number(row.id),
    bankAccountId: Number(row.bank_account_id ?? 0),
    bankAccountLabel: labels.get(Number(row.bank_account_id)) ?? "—",
    seriesStart: asString(row.series_start),
    seriesEnd: asString(row.series_end),
    nextNo: nextNo || null,
    isActive: asBoolean(row.is_active),
    createdAt: toPhtDateString(row.created_at),
  };
}

function emptyCounts(): Record<CheckStatus, number> {
  return Object.fromEntries(CHECK_STATUSES.map((status) => [status, 0])) as Record<CheckStatus, number>;
}

/** Totals over the whole register, independent of the list filters. */
async function countByStatus(): Promise<Record<CheckStatus, number>> {
  const entries = await Promise.all(
    CHECK_STATUSES.map(async (status) => {
      const { total } = await listItems<{ id: number }>(CHECKS, {
        fields: ["id"],
        filter: { status: { _eq: status } },
        limit: 1,
      });
      return [status, total] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<CheckStatus, number>;
}

function flagMatches(row: CheckRow, flag: CheckRegisterFlag): boolean {
  const status = checkStatus(row.status);
  const open = status === "PENDING" || status === "RECEIVED" || status === "IN_CLEARING";

  if (flag === "PDC") return asBoolean(row.is_pdc);
  if (flag === "STALE") return open && daysSince(row.check_date) > STALE_CHECK_DAYS;
  if (flag === "NOREPL") {
    return (status === "RETURNED" || status === "CANCELLED") && row.replaced_by_id == null;
  }
  return row.replaces_id != null || row.replaced_by_id != null;
}

async function listFilteredChecks(
  input: CheckRegisterFilter,
  accounts: { bankId: number; bankName: string }[],
): Promise<CheckRow[]> {
  const filter: Record<string, unknown> = {};
  if (input.direction) filter.direction = { _eq: input.direction };
  if (input.status) filter.status = { _eq: input.status };
  if (input.accountId) filter.bank_account_id = { _eq: input.accountId };

  if (input.bankName) {
    const ids = accounts.filter((account) => account.bankName === input.bankName).map((account) => account.bankId);
    filter.bank_account_id = { _in: ids.length ? ids : [-1] };
  }

  if (input.dateFrom || input.dateTo) {
    const range: Record<string, string> = {};
    if (input.dateFrom) range._gte = input.dateFrom;
    if (input.dateTo) range._lte = input.dateTo;
    filter.check_date = range;
  }

  const q = asString(input.q);
  if (q) {
    filter._or = [
      { check_no: { _icontains: q } },
      { payee: { _icontains: q } },
      { payor: { _icontains: q } },
      { drawee_bank: { _icontains: q } },
    ];
  }

  const { rows } = await listItems<CheckRow>(CHECKS, {
    fields: CHECK_FIELDS,
    filter: Object.keys(filter).length ? filter : undefined,
    sort: "-check_date,-id",
    // ponytail: 500-row cap on the unpaginated register; add paging once the list outgrows a screen.
    limit: 500,
  });
  return input.flag ? rows.filter((row) => flagMatches(row, input.flag as CheckRegisterFlag)) : rows;
}

export async function listCheckRegister(input: CheckRegisterFilter = {}): Promise<CheckRegisterResult> {
  const accounts = await listActiveAccounts();
  const labels = new Map(accounts.map((account) => [account.bankId, account.label]));

  let rows: CheckRow[] = [];
  let counts = emptyCounts();
  let notice: string | undefined;

  try {
    [rows, counts] = await Promise.all([listFilteredChecks(input, accounts), countByStatus()]);
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    notice = NOTICE_REGISTER;
  }

  const checkNos = await relatedCheckNumbers(rows);

  return {
    checks: rows.map((row) => toCheck(row, labels, checkNos)),
    counts,
    accounts,
    ...(notice ? { notice } : {}),
  };
}

/**
 * Check numbers for the replacement links on the current page.
 * The register shows "Replaced by <check no>", and a bare id is unreadable there.
 */
async function relatedCheckNumbers(rows: CheckRow[]): Promise<Map<number, string>> {
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [Number(row.replaces_id ?? 0), Number(row.replaced_by_id ?? 0)])
        .filter((id) => id > 0),
    ),
  ];
  if (!ids.length) return new Map();

  try {
    const { rows: related } = await listItems<{ id: number; check_no: string }>(CHECKS, {
      fields: ["id", "check_no"],
      filter: { id: { _in: ids } },
      limit: ids.length,
    });
    return new Map(related.map((row) => [Number(row.id), asString(row.check_no)]));
  } catch (error) {
    // The numbers are labels; the row dialog still resolves the related check by id.
    if (error instanceof DirectusError) return new Map();
    throw error;
  }
}

async function listEvents(checkId: number): Promise<CheckEvent[]> {
  let rows: EventRow[];
  try {
    ({ rows } = await listItems<EventRow>(EVENTS, {
      fields: EVENT_FIELDS,
      filter: { check_id: { _eq: checkId } },
      sort: "-id",
      limit: 200,
    }));
  } catch (error) {
    // Traffic in the register keeps working while the trail table is still missing.
    if (error instanceof DirectusError) return [];
    throw error;
  }

  if (!rows.length) return [];

  const jeIds = [...new Set(rows.map((row) => Number(row.journal_entry_id ?? 0)).filter((id) => id > 0))];
  const jeNos = new Map<number, string>();
  if (jeIds.length) {
    try {
      const { rows: entries } = await listItems<{ id: number; je_no: string }>(JOURNALS, {
        fields: ["id", "je_no"],
        filter: { id: { _in: jeIds } },
        limit: 200,
      });
      for (const entry of entries) jeNos.set(Number(entry.id), entry.je_no);
    } catch (error) {
      if (!(error instanceof DirectusError)) throw error;
    }
  }

  return rows.map((row) => ({
    id: Number(row.id),
    checkId: Number(row.check_id ?? 0),
    action: asString(row.action),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    eventCode: row.event_code,
    journalNo: row.journal_entry_id == null ? null : jeNos.get(Number(row.journal_entry_id)) ?? null,
    note: row.note,
    occurredAt: toPhtDateString(row.occurred_at),
  }));
}

async function loadCheckRow(checkId: number): Promise<CheckRow> {
  let row: CheckRow | null;
  try {
    row = await getItem<CheckRow>(CHECKS, checkId, CHECK_FIELDS);
  } catch (error) {
    if (error instanceof DirectusError) {
      throw new NotFoundError("This check could not be read. The check register table may not be available yet.");
    }
    throw error;
  }
  if (!row) throw new NotFoundError("Check not found.");
  return row;
}

async function reloadCheck(checkId: number): Promise<BankCheck> {
  let row: CheckRow | null = null;
  try {
    row = await getItem<CheckRow>(CHECKS, checkId, CHECK_FIELDS);
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
  }
  if (!row) throw new NotFoundError("The check was saved but could not be read back.");
  const accountId = Number(row.bank_account_id ?? 0);
  return toCheck(row, await accountLabels(accountId ? [accountId] : undefined));
}

export async function getCheckDetail(checkId: number): Promise<CheckDetail> {
  const row = await loadCheckRow(checkId);
  const accountId = Number(row.bank_account_id ?? 0);
  const [labels, events] = await Promise.all([
    accountLabels(accountId ? [accountId] : undefined),
    listEvents(checkId),
  ]);
  return { check: toCheck(row, labels), events };
}

type PostResult = { journalEntryId: number | null; postingBlocked: PostingBlocked | null };

/** A blocked posting is a configuration state, not a failed write: the check is still recorded. */
async function postCheckEntry(draft: JournalEntryDraft): Promise<PostResult> {
  try {
    const posted = await postJournalEntry(draft, null);
    return { journalEntryId: posted.id, postingBlocked: null };
  } catch (error) {
    if (error instanceof PostingBlockedError) {
      return {
        journalEntryId: null,
        postingBlocked: { message: error.message, missingMappingKeys: error.missingMappingKeys },
      };
    }
    throw error;
  }
}

type AppendEventInput = {
  checkId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  eventCode: string | null;
  journalEntryId: number | null;
  note: string | null;
};

async function appendEvent(input: AppendEventInput): Promise<void> {
  try {
    await createItem(EVENTS, {
      check_id: input.checkId,
      action: input.action,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      event_code: input.eventCode,
      journal_entry_id: input.journalEntryId,
      note: input.note,
      occurred_at: phtStamp(),
    });
  } catch (error) {
    // The check row is the record of the check; a missing trail table must not undo a
    // write that already happened.
    if (!(error instanceof DirectusError)) throw error;
  }
}

function draftBase(sourceRef: string, postingDate: string, description: string) {
  return { sourceRef, postingDate, description };
}

/** Numeric value of a series number: "0001234" and "1234" compare equal. */
function numericSeriesValue(value: string | null | undefined): number {
  const digits = asString(value).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatSeriesNo(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Next unused leaf of the account's active checkbook series. */
async function allocateCheckNo(accountId: number): Promise<string> {
  const { rows: series } = await listItems<CheckbookRow>(CHECKBOOKS, {
    fields: CHECKBOOK_FIELDS,
    filter: { bank_account_id: { _eq: accountId }, is_active: { _eq: true } },
    sort: "series_start",
    limit: 50,
  });

  if (!series.length) {
    throw new ConflictError(
      "This account has no active checkbook series. Add a checkbook series before issuing checks.",
    );
  }

  const { rows: issued } = await listItems<{ check_no: string | null }>(CHECKS, {
    fields: ["check_no"],
    filter: { bank_account_id: { _eq: accountId }, direction: { _eq: "ISSUED" } },
    limit: 1000,
  });
  const used = new Set(issued.map((row) => numericSeriesValue(row.check_no)));

  for (const book of series) {
    const start = numericSeriesValue(book.series_start);
    const end = numericSeriesValue(book.series_end);
    const width = asString(book.series_start).replace(/\D/g, "").length || 1;
    const storedNext = asString(book.next_no);

    let candidate = storedNext ? numericSeriesValue(storedNext) : start;
    while (candidate <= end && used.has(candidate)) candidate += 1;
    if (candidate > end) continue;

    await updateItem(CHECKBOOKS, book.id, { next_no: formatSeriesNo(candidate + 1, width) });
    return formatSeriesNo(candidate, width);
  }

  throw new ConflictError(
    "The active checkbook series for this account is exhausted. Add a new series before issuing more checks.",
  );
}

export async function issueCheck(input: IssueCheckInput): Promise<CheckWriteResult> {
  const amount = roundMoney(input.amount);
  const checkNo = await allocateCheckNo(input.bankAccountId);

  const created = await createItem<{ id: number }>(CHECKS, {
    bank_account_id: input.bankAccountId,
    direction: "ISSUED",
    check_no: checkNo,
    check_date: input.checkDate,
    amount,
    payee: input.payee,
    status: "PENDING",
    is_pdc: input.checkDate > phtToday() ? 1 : 0,
    source_type: "MANUAL",
    remarks: input.remarks,
    created_at: phtStamp(),
  });

  const posting = await postCheckEntry(
    issuedCheckEntry("E09", { bankId: input.bankAccountId, glCoaId: null }, amount, ISSUED_COUNTER_KEY, draftBase(
      checkNo,
      input.checkDate,
      `Check ${checkNo} issued to ${input.payee}`,
    )),
  );

  await appendEvent({
    checkId: Number(created.id),
    action: "ISSUE",
    fromStatus: null,
    toStatus: "PENDING",
    eventCode: "E09",
    journalEntryId: posting.journalEntryId,
    note: input.remarks,
  });

  return { check: await reloadCheck(Number(created.id)), postingBlocked: posting.postingBlocked };
}

export async function receiveCheck(input: ReceiveCheckInput): Promise<CheckWriteResult> {
  const amount = roundMoney(input.amount);
  const checkNo = asString(input.checkNo);

  const { rows: duplicates } = await listItems<{ id: number }>(CHECKS, {
    fields: ["id"],
    filter: {
      bank_account_id: { _eq: input.bankAccountId },
      direction: { _eq: "RECEIVED" },
      check_no: { _eq: checkNo },
    },
    limit: 1,
  });
  if (duplicates.length) {
    throw new ConflictError("Check number already recorded for this account.", "checkNo");
  }

  const created = await createItem<{ id: number }>(CHECKS, {
    bank_account_id: input.bankAccountId,
    direction: "RECEIVED",
    check_no: checkNo,
    check_date: input.checkDate,
    amount,
    drawee_bank: input.draweeBank,
    payor: input.payor,
    status: "RECEIVED",
    is_pdc: input.checkDate > phtToday() ? 1 : 0,
    source_type: "MANUAL",
    remarks: input.remarks,
    created_at: phtStamp(),
  });

  const posting = await postCheckEntry(
    receivedCheckEntry("E12", { bankId: input.bankAccountId, glCoaId: null }, amount, draftBase(
      checkNo,
      input.checkDate,
      `Check ${checkNo} received${input.payor ? ` from ${input.payor}` : ""}`,
    )),
  );

  await appendEvent({
    checkId: Number(created.id),
    action: "RECEIVE",
    fromStatus: null,
    toStatus: "RECEIVED",
    eventCode: "E12",
    journalEntryId: posting.journalEntryId,
    note: input.remarks,
  });

  return { check: await reloadCheck(Number(created.id)), postingBlocked: posting.postingBlocked };
}

export async function applyCheckAction(checkId: number, input: CheckActionInput): Promise<CheckWriteResult> {
  const row = await loadCheckRow(checkId);
  const status = checkStatus(row.status);
  const direction = checkDirection(row.direction);
  const amount = roundMoney(asNumber(row.amount));
  const checkNo = asString(row.check_no);
  const checkDate = toPhtDateString(row.check_date);
  const bankAccountId = Number(row.bank_account_id ?? 0);
  const account = { bankId: bankAccountId, glCoaId: null };
  const today = phtToday();
  const note = asString(input.note) || null;

  if (input.action === "RELEASE") {
    if (direction !== "ISSUED" || status !== "PENDING") {
      throw new ConflictError("Only a pending issued check can be released.", "action");
    }
    if (checkDate > today) {
      throw new ValidationError("A post-dated check cannot be released before its check date.", "checkDate");
    }

    await updateItem(CHECKS, checkId, { released_at: phtStamp() });
    await appendEvent({
      checkId,
      action: "RELEASE",
      fromStatus: status,
      toStatus: status,
      eventCode: null,
      journalEntryId: null,
      note,
    });
    return { check: await reloadCheck(checkId), postingBlocked: null };
  }

  if (input.action === "DEPOSIT") {
    if (direction !== "RECEIVED") {
      throw new ConflictError("Only a received check can be deposited.", "action");
    }
    if (status !== "RECEIVED" && status !== "PENDING") {
      throw new ConflictError("Only a check that has not been deposited can be deposited.", "action");
    }
    if (checkDate > today) {
      throw new ValidationError("A post-dated check cannot be deposited before its check date.", "checkDate");
    }

    await updateItem(CHECKS, checkId, { status: "IN_CLEARING", deposited_at: phtStamp() });
    await appendEvent({
      checkId,
      action: "DEPOSIT",
      fromStatus: status,
      toStatus: "IN_CLEARING",
      eventCode: null,
      journalEntryId: null,
      note,
    });
    return { check: await reloadCheck(checkId), postingBlocked: null };
  }

  if (input.action === "CLEAR") {
    if (direction === "ISSUED" && status !== "PENDING") {
      throw new ConflictError("Only a pending issued check can be marked cleared.", "action");
    }
    if (direction === "RECEIVED" && status !== "IN_CLEARING") {
      throw new ConflictError("A received check must be deposited before it can be marked cleared.", "action");
    }

    const clearedDate = asString(input.clearedDate) || today;
    if (!isCalendarDate(clearedDate)) {
      throw new ValidationError("Enter the date the bank cleared the check.", "clearedDate");
    }
    if (clearedDate > today) {
      throw new ValidationError("The clearing date cannot be in the future.", "clearedDate");
    }

    const posting =
      direction === "ISSUED"
        ? await postCheckEntry(
            issuedCheckEntry("E10", account, amount, ISSUED_COUNTER_KEY, draftBase(
              checkNo,
              clearedDate,
              `Check ${checkNo} cleared`,
            )),
          )
        : await postCheckEntry(
            receivedCheckEntry("E13", account, amount, draftBase(checkNo, clearedDate, `Check ${checkNo} cleared`)),
          );
    const eventCode = direction === "ISSUED" ? "E10" : "E13";

    await updateItem(CHECKS, checkId, { status: "CLEARED", cleared_at: `${clearedDate}T00:00:00` });
    await appendEvent({
      checkId,
      action: "CLEAR",
      fromStatus: status,
      toStatus: "CLEARED",
      eventCode,
      journalEntryId: posting.journalEntryId,
      note,
    });
    return { check: await reloadCheck(checkId), postingBlocked: posting.postingBlocked };
  }

  if (input.action === "RETURN") {
    const reason = asString(input.returnReason);
    if (!reason || !(CHECK_RETURN_REASONS as readonly string[]).includes(reason)) {
      throw new ValidationError("Pick a return reason from the list.", "returnReason");
    }
    if (status === "CLEARED" || status === "CANCELLED" || status === "RETURNED") {
      throw new ConflictError(`A ${status.toLowerCase()} check cannot be returned.`, "action");
    }

    const description = `Check ${checkNo} returned — ${reason}`;
    const posting =
      direction === "ISSUED"
        ? await postCheckEntry(
            issuedCheckEntry("E11", account, amount, ISSUED_COUNTER_KEY, draftBase(checkNo, today, description)),
          )
        : await postCheckEntry(
            receivedCheckEntry(status === "IN_CLEARING" ? "E15" : "E14", account, amount, draftBase(checkNo, today, description)),
          );
    const eventCode = direction === "ISSUED" ? "E11" : status === "IN_CLEARING" ? "E15" : "E14";

    await updateItem(CHECKS, checkId, {
      status: "RETURNED",
      returned_at: phtStamp(),
      return_reason: reason,
    });
    await appendEvent({
      checkId,
      action: "RETURN",
      fromStatus: status,
      toStatus: "RETURNED",
      eventCode,
      journalEntryId: posting.journalEntryId,
      note: note ?? reason,
    });
    return { check: await reloadCheck(checkId), postingBlocked: posting.postingBlocked };
  }

  if (input.action === "CANCEL") {
    if (status !== "PENDING" && status !== "RECEIVED") {
      throw new ConflictError("Only a pending or received check can be cancelled.", "action");
    }

    const description = `Check ${checkNo} cancelled${note ? ` — ${note}` : ""}`;
    const posting =
      direction === "ISSUED"
        ? await postCheckEntry(
            issuedCheckEntry("E11", account, amount, ISSUED_COUNTER_KEY, draftBase(checkNo, today, description)),
          )
        : await postCheckEntry(receivedCheckEntry("E14", account, amount, draftBase(checkNo, today, description)));
    const eventCode = direction === "ISSUED" ? "E11" : "E14";

    await updateItem(CHECKS, checkId, { status: "CANCELLED" });
    await appendEvent({
      checkId,
      action: "CANCEL",
      fromStatus: status,
      toStatus: "CANCELLED",
      eventCode,
      journalEntryId: posting.journalEntryId,
      note,
    });
    return { check: await reloadCheck(checkId), postingBlocked: posting.postingBlocked };
  }

  if (status !== "RETURNED" && status !== "CANCELLED") {
    throw new ConflictError("Only a returned or cancelled check can be replaced.", "action");
  }
  const replacement = input.replacement;
  if (!replacement) {
    throw new ValidationError("Give the replacement check date and amount.", "replacement");
  }

  const replacementAmount = roundMoney(replacement.amount);
  if (!(replacementAmount > 0)) {
    throw new ValidationError("Enter an amount greater than zero.", "replacement.amount");
  }

  const providedNo = asString(replacement.checkNo);
  let replacementNo: string;
  if (providedNo) {
    const { rows: duplicates } = await listItems<{ id: number }>(CHECKS, {
      fields: ["id"],
      filter: {
        bank_account_id: { _eq: bankAccountId },
        direction: { _eq: direction },
        check_no: { _eq: providedNo },
      },
      limit: 1,
    });
    if (duplicates.length) {
      throw new ConflictError("Check number already recorded for this account.", "replacement.checkNo");
    }
    replacementNo = providedNo;
  } else if (direction === "ISSUED") {
    replacementNo = await allocateCheckNo(bankAccountId);
  } else {
    throw new ValidationError("Give the replacement check number.", "replacement.checkNo");
  }

  const created = await createItem<{ id: number }>(CHECKS, {
    bank_account_id: bankAccountId,
    direction,
    check_no: replacementNo,
    check_date: replacement.checkDate,
    amount: replacementAmount,
    drawee_bank: row.drawee_bank,
    payee: row.payee,
    payor: row.payor,
    status: direction === "ISSUED" ? "PENDING" : "RECEIVED",
    is_pdc: replacement.checkDate > today ? 1 : 0,
    source_type: "REPLACEMENT",
    source_ref: checkNo,
    replaces_id: checkId,
    remarks: note,
    created_at: phtStamp(),
  });

  await updateItem(CHECKS, checkId, { replaced_by_id: Number(created.id) });
  await appendEvent({
    checkId,
    action: "REPLACE",
    fromStatus: status,
    toStatus: status,
    eventCode: null,
    journalEntryId: null,
    note: note ?? `Replaced by check ${replacementNo}.`,
  });

  return { check: await reloadCheck(Number(created.id)), postingBlocked: null };
}

export type ClearCheckEntry = { checkId: number; clearedDate: string };

export type ClearChecksResult = {
  cleared: BankCheck[];
  blocked: PostingBlocked[];
  failures: { checkId: number; message: string }[];
};

/**
 * Batch clearing: one bank statement line per check, so each carries its own date.
 * A rejected row does not abort the batch — it comes back in `failures` for the UI to show.
 */
export async function clearChecks(entries: ClearCheckEntry[]): Promise<ClearChecksResult> {
  const cleared: BankCheck[] = [];
  const blocked: PostingBlocked[] = [];
  const failures: { checkId: number; message: string }[] = [];

  for (const entry of entries) {
    try {
      const result = await applyCheckAction(entry.checkId, {
        action: "CLEAR",
        clearedDate: entry.clearedDate,
      });
      cleared.push(result.check);
      if (result.postingBlocked) blocked.push(result.postingBlocked);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        failures.push({ checkId: entry.checkId, message: error.message });
        continue;
      }
      throw error;
    }
  }

  return { cleared, blocked, failures };
}

export async function listCheckbooks(accountId?: number): Promise<CheckbookListResult> {
  let rows: CheckbookRow[];
  try {
    ({ rows } = await listItems<CheckbookRow>(CHECKBOOKS, {
      fields: CHECKBOOK_FIELDS,
      filter: accountId ? { bank_account_id: { _eq: accountId } } : undefined,
      sort: "series_start",
      limit: 200,
    }));
  } catch (error) {
    if (error instanceof DirectusError) return { series: [], notice: NOTICE_CHECKBOOKS };
    throw error;
  }

  const ids = [...new Set(rows.map((row) => Number(row.bank_account_id ?? 0)).filter((id) => id > 0))];
  const labels = await accountLabels(ids);
  return { series: rows.map((row) => toSeries(row, labels)) };
}

export async function createCheckbookSeries(input: CreateCheckbookInput): Promise<{ series: CheckbookSeries }> {
  const seriesStart = asString(input.seriesStart);
  const seriesEnd = asString(input.seriesEnd);
  const start = numericSeriesValue(seriesStart);
  const end = numericSeriesValue(seriesEnd);

  if (!start) throw new ValidationError("The series start must be a check number.", "seriesStart");
  if (!end) throw new ValidationError("The series end must be a check number.", "seriesEnd");
  if (end <= start) throw new ValidationError("The series end must be greater than the series start.", "seriesEnd");

  const { rows: existing } = await listItems<{ id: number; series_start: string | null; series_end: string | null }>(
    CHECKBOOKS,
    {
      fields: ["id", "series_start", "series_end"],
      filter: { bank_account_id: { _eq: input.bankAccountId } },
      limit: 500,
    },
  );

  const overlaps = existing.some((row) => {
    const otherStart = numericSeriesValue(row.series_start);
    const otherEnd = numericSeriesValue(row.series_end);
    return start <= otherEnd && end >= otherStart;
  });
  if (overlaps) throw new ConflictError("This series overlaps an existing checkbook.", "seriesStart");

  const created = await createItem<CheckbookRow>(CHECKBOOKS, {
    bank_account_id: input.bankAccountId,
    series_start: seriesStart,
    series_end: seriesEnd,
    next_no: seriesStart,
    is_active: true,
    created_at: phtStamp(),
  });

  const labels = await accountLabels([input.bankAccountId]);
  return { series: toSeries(created, labels) };
}
