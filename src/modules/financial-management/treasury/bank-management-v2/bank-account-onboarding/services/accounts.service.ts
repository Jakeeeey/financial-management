import "server-only";

import {
  asBoolean,
  asNumber,
  asNumberOrNull,
  asString,
  DirectusError,
  getItem,
  listItems,
} from "./directus";
import { ACCOUNT_TYPE_OPTIONS, ALL_OPTION, MISSING_COLUMNS_NOTICE, ONBOARDING_PAGE_SIZE } from "../constants";
import { toPhtDateString } from "../pht";
import type {
  AccountTypeOption,
  BankAccountStatus,
  BankAccountV2,
  BankOption,
  Currency,
  GlAccountOption,
  OnboardingFilterState,
  OnboardingListing,
  OnboardingOptions,
  OnboardingQuery,
} from "../types";

export type RawRow = Record<string, unknown>;

/** `chart_of_accounts.account_type` → `account_types` id 1 is CURRENT ASSETS. */
const CURRENT_ASSETS_ACCOUNT_TYPE_ID = 1;

const BASE_FIELDS = [
  "bank_id",
  "bank_name",
  "account_number",
  "account_name",
  "account_type",
  "branch",
  "opening_balance",
  "bank_description",
  "is_active",
  "created_at",
];

const V2_FIELDS = [
  "currency",
  "ifrs_category",
  "gl_coa_id",
  "account_status",
  "effective_date",
  "account_number_normalized",
];

export const ACCOUNT_FIELDS = [...BASE_FIELDS, ...V2_FIELDS];

const SCHEMA_ERROR_HINTS = [
  "does not exist",
  "unknown field",
  "invalid field",
  "permission to access field",
  "not permitted",
];

const UNREADABLE_NOTICE = "The account register could not be read from the banking instance right now.";

/**
 * True when Directus rejected the request because a column or collection is not
 * deployed yet, which is expected until the owner applies the new DDL.
 */
export function isSchemaError(error: unknown): boolean {
  if (!(error instanceof DirectusError)) return false;
  if (error.status !== 400 && error.status !== 403 && error.status !== 404) return false;
  const body = error.body.toLowerCase();
  return SCHEMA_ERROR_HINTS.some((hint) => body.includes(hint));
}

/** Duplicate keys are the only thing a unique index rejects on this collection. */
export function isDuplicateError(error: unknown): boolean {
  return error instanceof DirectusError && error.status === 400 && /unique/i.test(error.body);
}

/** Account numbers compare without punctuation and in upper case. */
export function normaliseAccountNumber(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export interface AccountRead {
  rows: RawRow[];
  notice?: string;
}

/** Reads every bank account, falling back to the pre-DDL columns. */
export async function readAccountRows(): Promise<AccountRead> {
  try {
    const { rows } = await listItems<RawRow>("bank_accounts", {
      fields: ACCOUNT_FIELDS,
      sort: "bank_name,account_number",
      limit: 500,
    });
    return { rows };
  } catch (error) {
    if (!isSchemaError(error)) throw error;
    const { rows } = await listItems<RawRow>("bank_accounts", {
      fields: BASE_FIELDS,
      sort: "bank_name,account_number",
      limit: 500,
    });
    return { rows, notice: MISSING_COLUMNS_NOTICE };
  }
}

/** Reads one account, falling back to the pre-DDL columns. */
export async function readAccountById(id: number): Promise<RawRow | null> {
  try {
    const row = await getItem<RawRow>("bank_accounts", id, ACCOUNT_FIELDS);
    return row ?? null;
  } catch (error) {
    if (!isSchemaError(error)) throw error;
    const row = await getItem<RawRow>("bank_accounts", id, BASE_FIELDS);
    return row ?? null;
  }
}

/** CURRENT ASSETS GL accounts, the only ones the onboarding dialog may link. */
export async function readCashAccounts(): Promise<{ accounts: GlAccountOption[]; notice?: string }> {
  try {
    const { rows } = await listItems<RawRow>("chart_of_accounts", {
      fields: ["coa_id", "gl_code", "account_title", "account_type"],
      sort: "gl_code",
      limit: 500,
    });
    // ponytail: chart_of_accounts holds 126 rows, so CURRENT ASSETS is filtered
    // here instead of with a relational filter the instance may reject.
    const accounts = rows
      .filter((row) => asNumber(row.account_type) === CURRENT_ASSETS_ACCOUNT_TYPE_ID)
      .map((row) => ({
        coaId: asNumber(row.coa_id),
        glCode: asString(row.gl_code),
        accountTitle: asString(row.account_title),
      }))
      .filter((account) => account.coaId > 0 && account.glCode !== "");
    return { accounts };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    return { accounts: [], notice: "The chart of accounts could not be read, so no GL accounts are available." };
  }
}

async function readRegistry(collection: string, labelField: "bank_name" | "account_type"): Promise<BankOption[]> {
  const read = async (fields: string[]) => {
    const { rows } = await listItems<RawRow>(collection, { fields, sort: labelField, limit: 500 });
    return rows
      .map((row) => ({ id: asNumberOrNull(row.id), name: asString(row[labelField]) }))
      .filter((option) => option.name !== "");
  };

  try {
    return await read(["id", labelField, "is_active"]);
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    try {
      return await read(["id", labelField]);
    } catch (retryError) {
      if (!(retryError instanceof DirectusError)) throw retryError;
      return [];
    }
  }
}

async function readLastReconciled(): Promise<Map<number, string>> {
  const latest = new Map<number, string>();
  try {
    const { rows } = await listItems<RawRow>("bank_reconciliation", {
      fields: ["id", "bank_id", "statement_date", "status"],
      filter: { status: { _eq: "RECONCILED" } },
      sort: "-statement_date",
      limit: 500,
    });
    for (const row of rows) {
      const bankId = asNumber(row.bank_id);
      const date = toPhtDateString(asString(row.statement_date));
      if (!bankId || !date) continue;
      const current = latest.get(bankId);
      if (!current || date > current) latest.set(bankId, date);
    }
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
  }
  return latest;
}

export interface MapContext {
  lastReconciled: Map<number, string>;
  glAccounts: Map<number, GlAccountOption>;
}

function normaliseStatus(raw: string, rawActive: unknown): BankAccountStatus {
  const upper = raw.toUpperCase();
  if (upper === "ACTIVE" || upper === "DORMANT" || upper === "CLOSED") return upper;
  if (rawActive === undefined || rawActive === null) return "ACTIVE";
  return asBoolean(rawActive) ? "ACTIVE" : "CLOSED";
}

/** Maps a Directus row to the v2 account shape the UI consumes. */
export function mapAccount(row: RawRow, context: MapContext): BankAccountV2 {
  const bankId = asNumber(row.bank_id);
  const openingBalance = asNumber(row.opening_balance);
  const glCoaId = asNumberOrNull(row.gl_coa_id);
  const gl = glCoaId === null ? undefined : context.glAccounts.get(glCoaId);

  return {
    bankId,
    bankName: asString(row.bank_name) || `Bank ${bankId}`,
    accountNumber: asString(row.account_number),
    accountName: asString(row.account_name) || null,
    accountType: asString(row.account_type) || null,
    branch: asString(row.branch) || null,
    currency: (asString(row.currency).toUpperCase() === "USD" ? "USD" : "PHP") as Currency,
    ifrsCategory: asString(row.ifrs_category) || "Amortized Cost",
    glCoaId,
    glCode: gl?.glCode ?? null,
    glTitle: gl?.accountTitle ?? null,
    status: normaliseStatus(asString(row.account_status), row.is_active),
    isActive: row.is_active === undefined || row.is_active === null ? true : asBoolean(row.is_active),
    openingBalance,
    // ponytail: nothing links journal entries to a bank account yet, so the book
    // balance mirrors the opening balance; the masterlist lane owns movements.
    bookBalance: openingBalance,
    effectiveDate: toPhtDateString(asString(row.effective_date)) || toPhtDateString(asString(row.created_at)) || null,
    lastReconciledAt: context.lastReconciled.get(bankId) ?? null,
    createdAt: asString(row.created_at) || null,
  };
}

/** Maps a freshly written row with the extra reads it needs to render. */
export async function mapAccountWithLookups(row: RawRow): Promise<BankAccountV2> {
  const [cash, lastReconciled] = await Promise.all([readCashAccounts(), readLastReconciled()]);
  return mapAccount(row, {
    lastReconciled,
    glAccounts: new Map(cash.accounts.map((account) => [account.coaId, account])),
  });
}

function matchesFilters(account: BankAccountV2, filters: OnboardingFilterState): boolean {
  if (filters.bank !== ALL_OPTION && account.bankName.toLowerCase() !== filters.bank.toLowerCase()) return false;
  if (filters.accountType !== ALL_OPTION && (account.accountType ?? "") !== filters.accountType) return false;
  if (filters.status !== ALL_OPTION && account.status !== filters.status) return false;
  if (filters.currency !== ALL_OPTION && account.currency !== filters.currency) return false;

  const search = filters.search.trim().toLowerCase();
  if (search === "") return true;

  const haystack = [
    account.bankName,
    account.accountNumber,
    normaliseAccountNumber(account.accountNumber),
    account.accountName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function clampPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) return ONBOARDING_PAGE_SIZE;
  return Math.min(Math.trunc(pageSize), 100);
}

async function readOptions(rows: RawRow[]): Promise<{ options: OnboardingOptions; notice?: string }> {
  const [bankRegistry, typeRegistry, cash] = await Promise.all([
    readRegistry("bank_names", "bank_name"),
    readRegistry("bank_account_types", "account_type"),
    readCashAccounts(),
  ]);

  const banks = new Map<string, BankOption>();
  for (const option of bankRegistry) banks.set(option.name.toLowerCase(), option);
  for (const row of rows) {
    const name = asString(row.bank_name);
    if (name !== "" && !banks.has(name.toLowerCase())) banks.set(name.toLowerCase(), { id: null, name });
  }

  const accountTypes: AccountTypeOption[] = ACCOUNT_TYPE_OPTIONS.map((name) => ({
    id: typeRegistry.find((option) => option.name.toLowerCase() === name.toLowerCase())?.id ?? null,
    name,
  }));
  // A register row can carry a type the form never offered; it must still be filterable.
  for (const row of rows) {
    const name = asString(row.account_type);
    if (name !== "" && !accountTypes.some((type) => type.name.toLowerCase() === name.toLowerCase())) {
      accountTypes.push({ id: null, name });
    }
  }

  return {
    options: {
      banks: [...banks.values()].sort((a, b) => a.name.localeCompare(b.name, "en-PH")),
      accountTypes,
      cashAccounts: cash.accounts,
    },
    notice: cash.notice,
  };
}

/** The list screen's only read: accounts, filters, pagination and dialog options. */
export async function listAccounts(query: OnboardingQuery): Promise<OnboardingListing> {
  const accountRead = await readAccountRows().catch((error: unknown) => {
    if (!(error instanceof DirectusError)) throw error;
    return { rows: [] as RawRow[], notice: UNREADABLE_NOTICE };
  });

  const [{ options, notice: optionsNotice }, lastReconciled] = await Promise.all([
    readOptions(accountRead.rows),
    readLastReconciled(),
  ]);

  const context: MapContext = {
    lastReconciled,
    glAccounts: new Map(options.cashAccounts.map((account) => [account.coaId, account])),
  };

  const filtered = accountRead.rows
    .map((row) => mapAccount(row, context))
    .filter((account) => matchesFilters(account, query))
    .sort(
      (a, b) =>
        a.bankName.localeCompare(b.bankName, "en-PH") || a.accountNumber.localeCompare(b.accountNumber, "en-PH"),
    );

  const pageSize = clampPageSize(query.pageSize);
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(query.page) || 1), lastPage);
  const start = (page - 1) * pageSize;

  return {
    rows: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    registerTotal: accountRead.rows.length,
    options,
    notice: [accountRead.notice, optionsNotice].filter(Boolean).join(" ") || undefined,
  };
}
