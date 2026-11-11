import "server-only";

import type { ArfFinding, ArfSeverity, AuditLogRow, BankAccountStatus, BankAccountV2, Currency, Paginated } from "../types";
import { STALE_CHECK_DAYS, UNCLEARED_DEPOSIT_DAYS } from "../constants";
import { daysSince, isUtcStamp, toPhtDateString, toPhtStampString } from "../pht";
import { DirectusError, asNumber, asString, listItems, roundMoney } from "./directus";

/**
 * Master List & Audit Logs reads.
 *
 * `bank_accounts` still lacks `currency`, `ifrs_category` and `gl_coa_id`, so those
 * columns are projected from the fallbacks below instead of being read. `account_status`
 * is read for real; `is_active` only fills the gap for rows that predate the column. `bank_audit_log` and `bank_checks`
 * do not exist yet: both reads swallow `DirectusError` and degrade to an empty list
 * plus a notice, because a missing collection must never become a 500.
 */

const ACCOUNT_FIELDS = [
  "bank_id",
  "bank_name",
  "account_number",
  "account_name",
  "account_type",
  "branch",
  "opening_balance",
  "is_active",
  "account_status",
  "created_at",
];

/** Cash collected but not yet handed to the bank; FSD 1.3. */
const CASH = 1;
const DEFAULT_CURRENCY: Currency = "PHP";
const DEFAULT_IFRS_CATEGORY = "Amortized Cost";
const UNDEPOSITED_CASH_DAYS = 1;

const MONEY = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type AccountRow = {
  bank_id: number | string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  account_type: string | null;
  branch: string | null;
  opening_balance: number | string | null;
  is_active: unknown;
  account_status: string | null;
  created_at: string | null;
};

/**
 * Directus hands MySQL BIT columns back as `{ type: "Buffer", data: [1] }`, not as a
 * boolean or a number, so a plain truthiness test reads every flag as truthy.
 */
function asFlag(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  if (typeof value === "object" && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data.some((byte) => Number(byte) !== 0);
  }
  return false;
}

function money(value: number): string {
  return MONEY.format(value);
}

const STATUS_VALUES: BankAccountStatus[] = ["ACTIVE", "DORMANT", "INACTIVE", "ESCHEATED", "CLOSED"];

function normaliseStatus(raw: string | null, isActive: boolean): BankAccountStatus {
  const value = (raw ?? "").trim().toUpperCase() as BankAccountStatus;
  if (STATUS_VALUES.includes(value)) return value;
  return isActive ? "ACTIVE" : "INACTIVE";
}

export type AccountsFilter = {
  status?: BankAccountStatus;
  currency?: Currency;
  accountType?: string;
  ifrsCategory?: string;
  q?: string;
  reconciliation?: "RECONCILED" | "UNRECONCILED";
};

export type AccountsResult = { accounts: BankAccountV2[]; notice?: string };

/** Cash deposited to each bank account, ignoring cancelled slips. */
async function loadDepositTotals(): Promise<Map<number, number>> {
  const { rows } = await listItems<{ target_bank_id: number | null; total_cash: number | string | null; status: string | null }>(
    "bank_deposit",
    { fields: ["target_bank_id", "total_cash", "status"], limit: -1 },
  );

  const totals = new Map<number, number>();
  for (const row of rows) {
    if (asString(row.status).toUpperCase() === "CANCELLED") continue;
    const bankId = asNumber(row.target_bank_id);
    if (!bankId) continue;
    totals.set(bankId, (totals.get(bankId) ?? 0) + asNumber(row.total_cash));
  }
  return totals;
}

/** Money paid out of each bank account. Optional: the balance still renders without it. */
async function loadDisbursementTotals(): Promise<Map<number, number> | null> {
  try {
    const { rows } = await listItems<{ bank_id: number | null; amount: number | string | null }>(
      "disbursement_payments",
      { fields: ["bank_id", "amount"], limit: -1 },
    );

    const totals = new Map<number, number>();
    for (const row of rows) {
      const bankId = asNumber(row.bank_id);
      if (!bankId) continue;
      totals.set(bankId, (totals.get(bankId) ?? 0) + asNumber(row.amount));
    }
    return totals;
  } catch (error) {
    if (error instanceof DirectusError) return null;
    throw error;
  }
}

/** Newest `statement_date` per bank, already sorted descending by Directus. */
async function loadLastReconciled(): Promise<Map<number, string>> {
  const { rows } = await listItems<{ bank_id: number | null; statement_date: string | null }>(
    "bank_reconciliation",
    { fields: ["bank_id", "statement_date"], sort: "-statement_date", limit: -1 },
  );

  const latest = new Map<number, string>();
  for (const row of rows) {
    const bankId = asNumber(row.bank_id);
    const date = asString(row.statement_date).slice(0, 10);
    if (!bankId || !date || latest.has(bankId)) continue;
    latest.set(bankId, date);
  }
  return latest;
}

/**
 * bookBalance = opening_balance
 *   + cash deposited to the account (`bank_deposit.total_cash` where
 *     `target_bank_id` is the account and the slip is not CANCELLED)
 *   − disbursement payments drawn on the account, when `disbursement_payments` is
 *     readable (skipped silently otherwise).
 *
 * Deposited checks are excluded on purpose: `bank_deposit.total_checks` is not money
 * in the account until the check clears, which Check & Clearing tracks separately.
 */
function toAccount(
  row: AccountRow,
  depositTotals: Map<number, number>,
  disbursementTotals: Map<number, number> | null,
  lastReconciled: Map<number, string>,
): BankAccountV2 {
  const bankId = asNumber(row.bank_id);
  const isActive = asFlag(row.is_active);
  const openingBalance = roundMoney(asNumber(row.opening_balance));
  const createdAt = toPhtStampString(asString(row.created_at)) || null;

  return {
    bankId,
    bankName: asString(row.bank_name),
    accountNumber: asString(row.account_number),
    accountName: asString(row.account_name) || null,
    accountType: asString(row.account_type) || null,
    branch: asString(row.branch) || null,
    currency: DEFAULT_CURRENCY,
    ifrsCategory: DEFAULT_IFRS_CATEGORY,
    glCoaId: null,
    glCode: null,
    glTitle: null,
    // Same vocabulary and same rule as dormancy: the status column is authoritative,
    // the flag only fills the gap for rows written before it existed.
    status: normaliseStatus(row.account_status, isActive),
    isActive,
    openingBalance,
    bookBalance: roundMoney(openingBalance + (depositTotals.get(bankId) ?? 0) - (disbursementTotals?.get(bankId) ?? 0)),
    effectiveDate: null,
    lastReconciledAt: lastReconciled.get(bankId) ?? null,
    createdAt,
  };
}

function matchesAccount(account: BankAccountV2, filter: AccountsFilter, needle: string): boolean {
  if (filter.status && account.status !== filter.status) return false;
  if (filter.currency && account.currency !== filter.currency) return false;
  if (filter.accountType && (account.accountType ?? "") !== filter.accountType) return false;
  if (filter.ifrsCategory && account.ifrsCategory !== filter.ifrsCategory) return false;
  if (filter.reconciliation === "RECONCILED" && !account.lastReconciledAt) return false;
  if (filter.reconciliation === "UNRECONCILED" && account.lastReconciledAt) return false;
  if (!needle) return true;
  return (
    account.bankName.toLowerCase().includes(needle) ||
    account.accountNumber.toLowerCase().includes(needle) ||
    (account.accountName ?? "").toLowerCase().includes(needle)
  );
}

export async function listAccounts(filter: AccountsFilter = {}): Promise<AccountsResult> {
  const [{ rows }, depositTotals, disbursementTotals, lastReconciled] = await Promise.all([
    listItems<AccountRow>("bank_accounts", { fields: ACCOUNT_FIELDS, sort: "bank_name,bank_id", limit: -1 }),
    loadDepositTotals(),
    loadDisbursementTotals(),
    loadLastReconciled(),
  ]);

  const needle = asString(filter.q).toLowerCase();
  const accounts = rows
    .map((row) => toAccount(row, depositTotals, disbursementTotals, lastReconciled))
    .filter((account) => account.bankId > 0 && matchesAccount(account, filter, needle));

  return { accounts };
}

export type ArfResult = { findings: ArfFinding[]; notice?: string };

const SEVERITY_ORDER: Record<ArfSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

/** CRITICAL, HIGH, MEDIUM, then newest first. */
function sortFindings(findings: ArfFinding[]): ArfFinding[] {
  return [...findings].sort((left, right) => {
    const bySeverity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (bySeverity !== 0) return bySeverity;
    return (right.occurredAt ?? "").localeCompare(left.occurredAt ?? "");
  });
}

async function undepositedCashFindings(labels: Map<number, string>): Promise<ArfFinding[]> {
  const [{ rows: details }, { rows: links }] = await Promise.all([
    listItems<{ id: number; collection_id: number | null; payment_method: number | null; amount: number | string | null; is_cleared: unknown; bank: number | null }>(
      "collection_details",
      { fields: ["id", "collection_id", "payment_method", "amount", "is_cleared", "bank"], limit: -1 },
    ),
    listItems<{ collection_detail_id: number | null }>("bank_deposit_details", {
      fields: ["collection_detail_id"],
      limit: -1,
    }),
  ]);

  const deposited = new Set(links.map((link) => asNumber(link.collection_detail_id)).filter(Boolean));
  const candidates = details.filter(
    (row) => asNumber(row.payment_method) === CASH && !asFlag(row.is_cleared) && !deposited.has(asNumber(row.id)),
  );
  if (!candidates.length) return [];

  const collectionIds = [...new Set(candidates.map((row) => asNumber(row.collection_id)).filter(Boolean))];
  const { rows: collections } = await listItems<{ id: number; docNo: string | null; collection_date: string | null; isCancelled: unknown }>(
    "collection",
    { fields: ["id", "docNo", "collection_date", "isCancelled"], filter: { id: { _in: collectionIds } }, limit: -1 },
  );
  const byId = new Map(collections.map((row) => [asNumber(row.id), row]));

  const findings: ArfFinding[] = [];
  for (const row of candidates) {
    const parent = byId.get(asNumber(row.collection_id));
    if (!parent || asFlag(parent.isCancelled)) continue;
    const ageDays = daysSince(parent.collection_date);
    if (ageDays < UNDEPOSITED_CASH_DAYS) continue;

    const document = asString(parent.docNo);
    findings.push({
      key: `cash:${asNumber(row.id)}`,
      severity: "HIGH",
      subModule: "Deposit",
      title: "Undeposited cash over 1 day",
      detail: `Cash of PHP ${money(asNumber(row.amount))} from ${document || `collection ${asNumber(row.collection_id)}`} has sat in the vault for ${ageDays} day${ageDays === 1 ? "" : "s"}.`,
      reference: document || null,
      occurredAt: toPhtDateString(parent.collection_date) || null,
      account: labels.get(asNumber(row.bank)) ?? null,
      amount: asNumber(row.amount),
      rule: `Cash collection unbanked ${UNDEPOSITED_CASH_DAYS} day after collection: payment_method = CASH, not cleared, and no bank_deposit_details link.`,
      source: `collection_details #${asNumber(row.id)}`,
    });
  }
  return findings;
}

async function unclearedDepositFindings(labels: Map<number, string>): Promise<ArfFinding[]> {
  const [{ rows: details }, { rows: deposits }] = await Promise.all([
    listItems<{ id: number; bank_deposit_id: number | null; deposit_status: string | null }>("bank_deposit_details", {
      fields: ["id", "bank_deposit_id", "deposit_status"],
      limit: -1,
    }),
    listItems<{ id: number; deposit_no: string | null; deposit_date: string | null; target_bank_id: number | null; total_cash: number | string | null; total_checks: number | string | null }>("bank_deposit", {
      fields: ["id", "deposit_no", "deposit_date", "target_bank_id", "total_cash", "total_checks"],
      limit: -1,
    }),
  ]);

  const byId = new Map(deposits.map((row) => [asNumber(row.id), row]));
  const findings: ArfFinding[] = [];
  for (const row of details) {
    if (asString(row.deposit_status).toUpperCase() !== "IN_TRANSIT") continue;
    const parent = byId.get(asNumber(row.bank_deposit_id));
    if (!parent) continue;
    const ageDays = daysSince(parent.deposit_date);
    if (ageDays < UNCLEARED_DEPOSIT_DAYS) continue;

    const document = asString(parent.deposit_no);
    findings.push({
      key: `uncleared:${asNumber(row.id)}`,
      severity: "HIGH",
      subModule: "Deposit",
      title: "Deposited check uncleared over 3 days",
      detail: `A check on ${document || "a deposit slip"} dated ${asString(parent.deposit_date) || "unknown"} is still in transit after ${ageDays} days.`,
      reference: document || null,
      occurredAt: toPhtDateString(parent.deposit_date) || null,
      account: labels.get(asNumber(parent.target_bank_id)) ?? null,
      amount: asNumber(parent.total_cash) + asNumber(parent.total_checks),
      rule: `Deposit slip still IN_TRANSIT ${UNCLEARED_DEPOSIT_DAYS} days after its deposit date (bank_deposit_details.deposit_status = IN_TRANSIT).`,
      source: `bank_deposit_details #${asNumber(row.id)}`,
    });
  }
  return findings;
}

type CheckRow = {
  id: number;
  check_no: string | null;
  check_date: string | null;
  status: string | null;
  replaced_by_id: number | null;
  created_at: string | null;
  amount: number | string | null;
  bank_account_id: number | null;
};

const OPEN_CHECK_STATUSES = new Set(["PENDING", "RECEIVED", "IN_CLEARING"]);
const RETURNED_CHECK_STATUSES = new Set(["RETURNED", "CANCELLED"]);

async function checkFindings(labels: Map<number, string>): Promise<{ findings: ArfFinding[]; notice?: string }> {
  let rows: CheckRow[];
  try {
    ({ rows } = await listItems<CheckRow>("bank_checks", {
      fields: ["id", "check_no", "check_date", "status", "replaced_by_id", "created_at", "amount", "bank_account_id"],
      limit: -1,
    }));
  } catch (error) {
    if (error instanceof DirectusError) {
      return {
        findings: [],
        notice: "The bank_checks register does not exist yet, so check findings (returned checks, stale checks) are unavailable.",
      };
    }
    throw error;
  }

  const findings: ArfFinding[] = [];
  for (const row of rows) {
    const checkNo = asString(row.check_no);
    const reference = checkNo || null;
    const status = asString(row.status).toUpperCase();

    if (RETURNED_CHECK_STATUSES.has(status) && !asNumber(row.replaced_by_id)) {
      findings.push({
        key: `replace:${asNumber(row.id)}`,
        severity: "HIGH",
        subModule: "Check & Clearing",
        title: "Returned or cancelled check not replaced",
        detail: `Check ${checkNo || asNumber(row.id)} is ${status.toLowerCase()} and no replacement check is linked.`,
        reference,
        occurredAt: toPhtDateString(row.check_date) || null,
        account: labels.get(asNumber(row.bank_account_id)) ?? null,
        amount: asNumber(row.amount),
        rule: `Check is ${status} and no replacement check is linked (replaced_by_id is empty).`,
        source: `bank_checks #${asNumber(row.id)}`,
      });
    }

    if (OPEN_CHECK_STATUSES.has(status)) {
      const ageDays = daysSince(row.check_date);
      if (ageDays >= STALE_CHECK_DAYS) {
        findings.push({
          key: `stale:${asNumber(row.id)}`,
          severity: "MEDIUM",
          subModule: "Check & Clearing",
          title: "Stale check over 180 days",
          detail: `Check ${checkNo || asNumber(row.id)} has been ${status.toLowerCase().replace(/_/g, " ")} for ${ageDays} days; a check is stale after ${STALE_CHECK_DAYS} days.`,
          reference,
          occurredAt: toPhtDateString(row.check_date) || null,
          account: labels.get(asNumber(row.bank_account_id)) ?? null,
          amount: asNumber(row.amount),
          rule: `Check still ${status} after ${STALE_CHECK_DAYS} days; a check is stale after ${STALE_CHECK_DAYS} days.`,
          source: `bank_checks #${asNumber(row.id)}`,
        });
      }
    }
  }
  return { findings };
}

/** `bank_name · account_number` per account, so a finding can name the account it sits on. */
async function loadAccountLabels(): Promise<Map<number, string>> {
  try {
    const { rows } = await listItems<{ bank_id: number | null; bank_name: string | null; account_number: string | null }>(
      "bank_accounts",
      { fields: ["bank_id", "bank_name", "account_number"], limit: -1 },
    );
    return new Map(
      rows.map((row) => [
        asNumber(row.bank_id),
        [asString(row.bank_name), asString(row.account_number)].filter(Boolean).join(" · "),
      ]),
    );
  } catch (error) {
    // A missing label must not hide the finding; the dialog simply shows no account.
    if (error instanceof DirectusError) return new Map();
    throw error;
  }
}

/** Recomputes every ARF finding per call; nothing is persisted. */
export async function listFindings(): Promise<ArfResult> {
  const labels = await loadAccountLabels();
  const [cash, uncleared, checks] = await Promise.all([
    undepositedCashFindings(labels),
    unclearedDepositFindings(labels),
    checkFindings(labels),
  ]);

  const findings = sortFindings([...cash, ...uncleared, ...checks.findings]);
  return checks.notice ? { findings, notice: checks.notice } : { findings };
}

export type AuditFilter = {
  module?: string;
  user?: string;
  pht?: "PHT" | "NOT_PHT";
  q?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

/** Selectable values for the movement log's Module and User pickers, read from the table itself. */
export type AuditFacets = { modules: string[]; users: string[] };

export type AuditResult = Paginated<AuditLogRow> & { notice?: string; facets: AuditFacets };

type AuditRow = {
  id: number;
  occurred_at: string | null;
  module: string | null;
  action: string | null;
  reference: string | null;
  detail: string | null;
  actor_id: number | null;
  actor_name: string | null;
  legacy_utc_at: string | null;
};

const AUDIT_FIELDS = ["id", "occurred_at", "module", "action", "reference", "detail", "actor_id", "actor_name", "legacy_utc_at"];

/**
 * A stamp already in PHT wall clock is returned untouched; only a legacy UTC stamp is
 * shifted, otherwise every audit row would drift eight hours later than it happened.
 */
function phtStampFromRow(value: string): string {
  if (!value) return "";
  if (isUtcStamp(value)) return toPhtStampString(value);
  // The FSD stores PHT wall clock, so a naive stamp is already correct as-is.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) ? value.slice(0, 19) : toPhtStampString(value);
}

function auditWhere(filter: AuditFilter): Record<string, unknown> | undefined {
  const conditions: Record<string, unknown>[] = [];
  if (filter.module) conditions.push({ module: { _eq: filter.module } });
  if (filter.user) conditions.push({ actor_name: { _eq: filter.user } });
  // A legacy UTC import is the one flagged with `legacy_utc_at`; everything else was written in PHT.
  if (filter.pht === "PHT") conditions.push({ legacy_utc_at: { _null: true } });
  if (filter.pht === "NOT_PHT") conditions.push({ legacy_utc_at: { _nnull: true } });
  // from/to are inclusive PHT calendar days, so the upper bound covers the whole day.
  if (filter.from) conditions.push({ occurred_at: { _gte: `${filter.from}T00:00:00` } });
  if (filter.to) conditions.push({ occurred_at: { _lte: `${filter.to}T23:59:59` } });
  if (filter.q) {
    conditions.push({
      _or: [{ action: { _contains: filter.q } }, { reference: { _contains: filter.q } }],
    });
  }
  return conditions.length ? { _and: conditions } : undefined;
}

async function loadAuditFacets(): Promise<AuditFacets> {
  try {
    const { rows } = await listItems<{ module: string | null; actor_name: string | null }>("bank_audit_log", {
      fields: ["module", "actor_name"],
      limit: -1,
    });
    return {
      modules: [...new Set(rows.map((row) => asString(row.module)).filter(Boolean))].sort(),
      users: [...new Set(rows.map((row) => asString(row.actor_name)).filter(Boolean))].sort(),
    };
  } catch (error) {
    if (error instanceof DirectusError) return { modules: [], users: [] };
    throw error;
  }
}

export async function listAuditLog(filter: AuditFilter): Promise<AuditResult> {
  const empty: AuditResult = { rows: [], total: 0, page: filter.page, pageSize: filter.pageSize, facets: { modules: [], users: [] } };

  try {
    const [{ rows, total }, facets] = await Promise.all([
      listItems<AuditRow>("bank_audit_log", {
        fields: AUDIT_FIELDS,
        filter: auditWhere(filter),
        sort: "-occurred_at",
        limit: filter.pageSize,
        page: filter.page,
      }),
      loadAuditFacets(),
    ]);

    return {
      rows: rows.map((row) => ({
        id: asNumber(row.id),
        occurredAt: phtStampFromRow(asString(row.occurred_at)) || asString(row.occurred_at),
        module: asString(row.module),
        action: asString(row.action),
        reference: asString(row.reference) || null,
        detail: asString(row.detail) || null,
        actorName: asString(row.actor_name) || null,
        legacyUtcAt: asString(row.legacy_utc_at) || null,
      })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      facets,
    };
  } catch (error) {
    if (error instanceof DirectusError) {
      return { ...empty, notice: "The bank_audit_log table does not exist yet, so no audit entries can be shown." };
    }
    throw error;
  }
}
