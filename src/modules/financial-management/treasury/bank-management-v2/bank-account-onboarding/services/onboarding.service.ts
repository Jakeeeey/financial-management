import "server-only";

import {
  asString,
  createItem,
  DirectusError,
  listItems,
  roundMoney,
  updateItem,
} from "./directus";
import {
  isDuplicateError,
  isSchemaError,
  mapAccountWithLookups,
  normaliseAccountNumber,
  readAccountById,
  readAccountRows,
  readCashAccounts,
  type RawRow,
} from "./accounts.service";
import { PostingBlockedError, postJournalEntry } from "./gl.service";
import { openingBalanceEntry } from "../events";
import { phtStamp } from "../pht";
import type { BankAccountV2, RegisterAccountResult, UpdateAccountResult } from "../types";
import type { RegisterAccountBody, UpdateAccountBody } from "../schemas";

export class OnboardingValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "OnboardingValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class OnboardingConflictError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "OnboardingConflictError";
    this.fieldErrors = fieldErrors;
  }
}

export class OnboardingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingNotFoundError";
  }
}

/**
 * The account was created but E01 could not post because `bank_gl_mapping` still
 * has null counterparts. Surfaced as 409 with the missing keys.
 */
export class OpeningBalanceBlockedError extends Error {
  readonly missingMappingKeys: string[];

  constructor(message: string, missingMappingKeys: string[]) {
    super(message);
    this.name = "OpeningBalanceBlockedError";
    this.missingMappingKeys = missingMappingKeys;
  }
}

/** Maps a service failure to the route's status and JSON body. */
export function describeOnboardingError(
  error: unknown,
  context: string,
): { status: number; body: Record<string, unknown> } {
  if (error instanceof OnboardingConflictError) {
    return { status: 409, body: { success: false, error: error.message, fieldErrors: error.fieldErrors } };
  }
  if (error instanceof OpeningBalanceBlockedError) {
    return {
      status: 409,
      body: { success: false, error: error.message, missingMappingKeys: error.missingMappingKeys },
    };
  }
  if (error instanceof OnboardingValidationError) {
    return { status: 400, body: { success: false, error: error.message, fieldErrors: error.fieldErrors } };
  }
  if (error instanceof OnboardingNotFoundError) {
    return { status: 404, body: { success: false, error: error.message } };
  }

  console.error(context, error);
  if (error instanceof DirectusError) {
    return { status: 500, body: { success: false, error: "The banking instance rejected the request." } };
  }
  return { status: 500, body: { success: false, error: "The request could not be completed." } };
}

const DUPLICATE_MESSAGE = "That account number is already registered for this bank.";

function duplicateError(): OnboardingConflictError {
  return new OnboardingConflictError(DUPLICATE_MESSAGE, { accountNumber: [DUPLICATE_MESSAGE] });
}

async function assertUniqueAccountNumber(bankName: string, normalized: string): Promise<void> {
  const { rows } = await readAccountRows();
  const taken = rows.some(
    (row) =>
      asString(row.bank_name).toLowerCase() === bankName.toLowerCase() &&
      normaliseAccountNumber(asString(row.account_number)) === normalized,
  );
  if (taken) throw duplicateError();
}

async function assertLinkedGl(glCoaId: number): Promise<void> {
  const { accounts } = await readCashAccounts();
  // An unreadable chart of accounts must not block onboarding; posting still
  // validates the key against the mapping.
  if (accounts.length === 0) return;
  if (accounts.some((account) => account.coaId === glCoaId)) return;
  throw new OnboardingValidationError("Choose a current-asset GL account.", {
    glCoaId: ["Choose a current-asset GL account."],
  });
}

async function ensureBankName(bankName: string): Promise<void> {
  try {
    const { total } = await listItems<RawRow>("bank_names", {
      fields: ["id"],
      filter: { bank_name: { _ieq: bankName } },
      limit: 1,
    });
    if (total > 0) return;
    await createItem("bank_names", { bank_name: bankName, is_active: 1 });
  } catch (error) {
    // The registry row only feeds later pickers; never lose the account over it.
    if (!(error instanceof DirectusError)) throw error;
  }
}

async function accountAlreadyPosted(sourceRef: string): Promise<boolean> {
  try {
    const { total } = await listItems<RawRow>("bank_journal_entries", {
      fields: ["id"],
      filter: { _and: [{ event_code: { _eq: "E01" } }, { source_ref: { _eq: sourceRef } }] },
      limit: 1,
    });
    return total > 0;
  } catch (error) {
    // Journal tables land with the same DDL as the new columns; absence means "not posted yet".
    if (error instanceof DirectusError) return false;
    throw error;
  }
}

async function postOpeningBalance(
  account: BankAccountV2,
  amount: number,
  postingDate: string,
): Promise<{ posted: boolean; notice?: string }> {
  const sourceRef = `${account.bankId}-${normaliseAccountNumber(account.accountNumber)}`;
  if (await accountAlreadyPosted(sourceRef)) return { posted: true };

  const draft = openingBalanceEntry(
    { bankId: account.bankId, glCoaId: account.glCoaId },
    amount,
    {
      sourceRef,
      postingDate,
      description: `Opening balance · ${account.bankName} ${account.accountNumber}`,
    },
  );

  try {
    await postJournalEntry(draft);
    return { posted: true };
  } catch (error) {
    if (error instanceof PostingBlockedError) {
      throw new OpeningBalanceBlockedError(
        "The account was created, but the opening balance entry is blocked because the GL mapping is incomplete.",
        error.missingMappingKeys,
      );
    }
    if (error instanceof DirectusError) {
      return {
        posted: false,
        notice:
          "The account was created, but the opening balance entry was not posted because the journal tables are not in the database yet.",
      };
    }
    throw error;
  }
}

/** Creates the account, registers unknown banks, then posts E01 once when funded. */
export async function createAccount(body: RegisterAccountBody): Promise<RegisterAccountResult> {
  const bankName = body.bankName.trim();
  const normalized = normaliseAccountNumber(body.accountNumber);
  if (normalized === "") {
    throw new OnboardingValidationError("Enter a valid account number.", {
      accountNumber: ["Enter a valid account number."],
    });
  }

  await assertLinkedGl(body.glCoaId);
  await assertUniqueAccountNumber(bankName, normalized);

  const payload: Record<string, unknown> = {
    bank_name: bankName,
    branch: body.branch.trim(),
    account_number: body.accountNumber.trim(),
    account_name: body.accountName.trim(),
    account_type: body.accountType,
    opening_balance: roundMoney(body.openingBalance),
    bank_description: body.remarks?.trim() || null,
    is_active: 1,
    created_at: phtStamp(),
    currency: body.accountType === "FCA" ? "USD" : "PHP",
    ifrs_category: "Amortized Cost",
    gl_coa_id: body.glCoaId,
    account_status: "ACTIVE",
    effective_date: body.effectiveDate,
    account_number_normalized: normalized,
  };

  const written = await writeAccount("create", payload);
  const account = await mapAccountWithLookups(written.row);
  await ensureBankName(bankName);

  if (account.openingBalance <= 0) {
    return { account, openingBalancePosted: false, notice: written.notice };
  }

  const posting = await postOpeningBalance(account, account.openingBalance, body.effectiveDate);
  return {
    account,
    openingBalancePosted: posting.posted,
    notice: [written.notice, posting.notice].filter(Boolean).join(" ") || undefined,
  };
}

/** Edits the fields the FSD allows after onboarding; status drives `is_active`. */
export async function updateAccount(id: number, body: UpdateAccountBody): Promise<UpdateAccountResult> {
  const existing = await readAccountById(id);
  if (!existing) throw new OnboardingNotFoundError("That account no longer exists.");

  await assertLinkedGl(body.glCoaId);

  const payload: Record<string, unknown> = {
    account_name: body.accountName.trim(),
    branch: body.branch.trim(),
    account_type: body.accountType,
    currency: body.accountType === "FCA" ? "USD" : "PHP",
    gl_coa_id: body.glCoaId,
    account_status: body.status,
    effective_date: body.effectiveDate,
    is_active: body.status === "CLOSED" ? 0 : 1,
  };

  const written = await writeAccount("update", payload, id);
  return { account: await mapAccountWithLookups(written.row), notice: written.notice };
}

/**
 * Writes with the full v2 column set and retries with the pre-DDL columns when the
 * instance rejects the new ones, so the lane works before and after the migration.
 */
async function writeAccount(
  mode: "create" | "update",
  payload: Record<string, unknown>,
  id?: number,
): Promise<{ row: RawRow; notice?: string }> {
  try {
    const row =
      mode === "create"
        ? await createItem<RawRow>("bank_accounts", payload)
        : await updateItem<RawRow>("bank_accounts", id as number, payload);
    return { row };
  } catch (error) {
    if (isDuplicateError(error)) throw duplicateError();
    if (!isSchemaError(error)) throw error;

    const legacy: Record<string, unknown> = {
      bank_name: payload.bank_name,
      branch: payload.branch,
      account_number: payload.account_number,
      account_name: payload.account_name,
      account_type: payload.account_type,
      opening_balance: payload.opening_balance,
      bank_description: payload.bank_description,
      is_active: payload.is_active,
      created_at: payload.created_at,
    };
    const base = Object.fromEntries(Object.entries(legacy).filter(([, value]) => value !== undefined));

    try {
      const row =
        mode === "create"
          ? await createItem<RawRow>("bank_accounts", base)
          : await updateItem<RawRow>("bank_accounts", id as number, base);
      return {
        row,
        notice: "The account was saved without the new v2 fields because those columns are not in the database yet.",
      };
    } catch (retryError) {
      if (isDuplicateError(retryError)) throw duplicateError();
      throw retryError;
    }
  }
}
