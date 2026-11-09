import "server-only";

import type { AccountOption, ExpenseAccountOption } from "../types";
import { asNumber, asNumberOrNull, asString, DirectusError, listItems, roundMoney } from "./directus";

/**
 * Bank account and expense-account lookups for the transactions lane.
 *
 * `bank_accounts` is extended by the V2 DDL (`currency`, `gl_coa_id`, `account_status`), so the
 * read tries the V2 field list first and falls back to the columns that exist today: the lane
 * has to render before the owner applies the migration.
 */

export interface AccountRef {
  bankId: number;
  bankName: string;
  label: string;
  currency: string;
  glCoaId: number | null;
  openingBalance: number;
  bookBalance: number;
}

type BankRow = Record<string, unknown>;
type MemoBalanceRow = Record<string, unknown>;
type TransferBalanceRow = Record<string, unknown>;

const V2_FIELDS = [
  "bank_id",
  "bank_name",
  "account_number",
  "branch",
  "opening_balance",
  "is_active",
  "currency",
  "gl_coa_id",
  "account_status",
];

const LEGACY_FIELDS = ["bank_id", "bank_name", "account_number", "branch", "opening_balance", "is_active"];

export interface AccountsResult {
  accounts: AccountRef[];
  notice: string | null;
}

/** All usable bank accounts with an estimated book balance. */
export async function listAccounts(): Promise<AccountsResult> {
  const { rows, v2FieldsMissing } = await readAccounts();
  const deltas = await balanceDeltas();
  const accounts = rows
    .map((row) => toAccountRef(row, deltas))
    .filter((account): account is AccountRef => account !== null)
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    accounts,
    notice: v2FieldsMissing
      ? "Account currency and GL link are not stored yet, so balances use the legacy columns. Cash postings fall back to the shared cash-in-bank mapping."
      : null,
  };
}

/** One account by id, or null when it no longer exists. */
export async function getAccount(bankId: number): Promise<AccountRef | null> {
  const { accounts } = await listAccounts();
  return accounts.find((account) => account.bankId === bankId) ?? null;
}

export function toAccountOption(account: AccountRef): AccountOption {
  return {
    bankId: account.bankId,
    bankName: account.bankName,
    label: account.label,
    currency: account.currency,
    bookBalance: account.bookBalance,
  };
}

/** Expense accounts are chart_of_accounts account_type 7–10, per FSD 1.2. */
export async function listExpenseAccounts(): Promise<ExpenseAccountOption[]> {
  const { rows } = await listItems<Record<string, unknown>>("chart_of_accounts", {
    fields: ["coa_id", "gl_code", "account_title"],
    filter: { account_type: { _gte: 7, _lte: 10 } },
    sort: "gl_code",
    limit: 500,
  });

  return rows
    .map((row) => ({
      coaId: asNumber(row.coa_id),
      glCode: asString(row.gl_code),
      title: asString(row.account_title),
    }))
    .filter((row) => row.coaId > 0 && row.title.length > 0);
}

async function readAccounts(): Promise<{ rows: BankRow[]; v2FieldsMissing: boolean }> {
  try {
    const { rows } = await listItems<BankRow>("bank_accounts", {
      fields: V2_FIELDS,
      filter: { is_active: { _eq: true } },
      sort: "bank_name",
      limit: 200,
    });
    return { rows, v2FieldsMissing: false };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    const { rows } = await listItems<BankRow>("bank_accounts", {
      fields: LEGACY_FIELDS,
      filter: { is_active: { _eq: true } },
      sort: "bank_name",
      limit: 200,
    });
    return { rows, v2FieldsMissing: true };
  }
}

function toAccountRef(row: BankRow, deltas: Map<number, number>): AccountRef | null {
  const bankId = asNumber(row.bank_id);
  if (!bankId) return null;

  const bankName = asString(row.bank_name) || "Bank account";
  const accountNumber = asString(row.account_number);
  const openingBalance = asNumber(row.opening_balance);

  return {
    bankId,
    bankName,
    label: accountNumber ? `${bankName} — ${accountNumber}` : bankName,
    currency: asString(row.currency) || "PHP",
    glCoaId: asNumberOrNull(row.gl_coa_id),
    openingBalance,
    bookBalance: roundMoney(openingBalance + (deltas.get(bankId) ?? 0)),
  };
}

/**
 * Opening balance plus everything this lane has posted.
 *
 * ponytail: deposits, checks and disbursements from the sibling lanes are not summed here yet, so
 * the figure under-reports a working balance until those lanes land; it only drives the soft
 * overdraft hint, never a posting rule. Swap in the aggregate queries when they exist.
 */
async function balanceDeltas(): Promise<Map<number, number>> {
  const deltas = new Map<number, number>();
  const add = (bankId: number, value: number) => {
    if (!bankId || !value) return;
    deltas.set(bankId, roundMoney((deltas.get(bankId) ?? 0) + value));
  };

  await settle("bank_memos", async () => {
    const { rows } = await listItems<MemoBalanceRow>("bank_memos", {
      fields: ["bank_account_id", "memo_type", "amount", "status"],
      filter: { status: { _eq: "POSTED" } },
      limit: 1000,
    });
    for (const row of rows) {
      const amount = asNumber(row.amount);
      add(asNumber(row.bank_account_id), asString(row.memo_type) === "DEBIT" ? -amount : amount);
    }
  });

  await settle("bank_transfers", async () => {
    const { rows } = await listItems<TransferBalanceRow>("bank_transfers", {
      fields: ["source_bank_id", "destination_bank_id", "amount", "transfer_fee", "status"],
      filter: { status: { _in: ["PENDING", "COMPLETED"] } },
      limit: 1000,
    });
    for (const row of rows) {
      const status = asString(row.status).toUpperCase();
      // Leg 1 already left the source at PENDING; the destination only lands at COMPLETED.
      add(asNumber(row.source_bank_id), -(asNumber(row.amount) + asNumber(row.transfer_fee)));
      if (status === "COMPLETED") add(asNumber(row.destination_bank_id), asNumber(row.amount));
    }
  });

  return deltas;
}

/**
 * Best-effort read: a soft balance hint is not worth failing the page over, and
 * `bank_memos` does not exist until the V2 DDL is applied.
 */
async function settle(label: string, read: () => Promise<void>): Promise<void> {
  try {
    await read();
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    console.warn(`[bank-management-v2] ${label} balance read skipped: ${error.status}`);
  }
}
