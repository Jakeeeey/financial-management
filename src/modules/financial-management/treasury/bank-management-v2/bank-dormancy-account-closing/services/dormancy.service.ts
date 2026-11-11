import "server-only";

import {
  DirectusError,
  asBoolean,
  asNumber,
  asString,
  listItems,
  roundMoney,
  updateItem,
} from "./directus";
import { postJournalEntry, PostingBlockedError, resolveJournalEntry } from "./gl.service";
import { closureSettlementEntry, dormancyReclassEntry, escheatEntry } from "../events";
import { phtStamp, phtToday } from "../pht";
import {
  DORMANT_MONTHS,
  ESCHEAT_MONTHS,
  FINAL_WHT_RATE,
  INACTIVE_MONTHS,
  RETENTION_YEARS,
} from "../constants";
import type {
  BankAccountStatus,
  DormancyAccount,
  DormancyClass,
  PreClosureCheck,
  PreClosureResult,
  SettlementInput,
  SettlementPlan,
  ActionOutcome,
  EscheatRemittance,
} from "../types";

/**
 * Dormancy scan and the closure gate (FSD §3.5).
 *
 * "Customer activity" is deliberately narrow: customer deposits, transfers, released
 * and issued checks. Bank-initiated memos and interest never reset the clock, which is
 * the rule that makes dormancy under IAS 32 meaningful.
 */

const ACCOUNTS = "bank_accounts";

const ACCOUNT_FIELDS = [
  "bank_id",
  "bank_name",
  "account_number",
  "account_name",
  "account_type",
  "branch",
  "account_status",
  "currency",
  "gl_coa_id",
  "opening_balance",
  "is_active",
  "effective_date",
  "retain_until",
  "created_at",
];

/** Added by the dormancy DDL; a missing column must not break the scan. */
const LIFECYCLE_FIELDS = ["bank_id", "dormant_since", "escheated_at", "closed_at", "closure_reason"];

export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

type AccountRow = Record<string, unknown>;

type Lifecycle = {
  dormantSince: string | null;
  escheatedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
};

type Activity = { date: string; source: string };

const ACCOUNT_STATUS_VALUES = ["ACTIVE", "DORMANT", "INACTIVE", "ESCHEATED", "CLOSED"] as const;

function statusOf(row: AccountRow): BankAccountStatus {
  const raw = asString(row.account_status).toUpperCase();
  if ((ACCOUNT_STATUS_VALUES as readonly string[]).includes(raw)) return raw as BankAccountStatus;
  // No usable status string: a row is transactable only when it is both active and ACTIVE,
  // so an unknown row falls back to the frozen side rather than silently reading as ACTIVE.
  return asBoolean(row.is_active) ? "ACTIVE" : "INACTIVE";
}

function daysIn(month: number): number {
  return new Date(Date.UTC(2000, month, 0)).getUTCDate();
}

/** Whole months between two `YYYY-MM-DD…` PHT stamps, never negative. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = to.slice(0, 10).split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return 0;
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < Math.min(fd, daysIn(tm))) months -= 1;
  return Math.max(0, months);
}

function classify(months: number, status: BankAccountStatus): DormancyClass {
  if (status === "DORMANT") return months >= ESCHEAT_MONTHS ? "ESCHEAT_ELIGIBLE" : "DORMANT";
  if (months >= DORMANT_MONTHS) return "DORMANT_ELIGIBLE";
  if (months >= INACTIVE_MONTHS) return "INACTIVE";
  return "ACTIVE";
}

/** Cash deposited per account, ignoring cancelled slips (same rule as the masterlist). */
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

/** Newest customer-initiated movement per account, across every source that counts. */
async function loadActivity(): Promise<Map<number, Activity>> {
  const activity = new Map<number, Activity>();
  const record = (bankId: number, date: string, source: string) => {
    if (!bankId || !date) return;
    const current = activity.get(bankId);
    if (!current || date > current.date) activity.set(bankId, { date, source });
  };

  const [deposits, transfers, checks] = await Promise.all([
    listItems<{ target_bank_id: number | null; deposit_date: string | null; status: string | null }>("bank_deposit", {
      fields: ["target_bank_id", "deposit_date", "status"],
      limit: -1,
    }).catch(() => ({ rows: [] as Array<{ target_bank_id: number | null; deposit_date: string | null; status: string | null }> })),
    listItems<{ source_bank_id: number | null; transfer_date: string | null; status: string | null }>("bank_transfers", {
      fields: ["source_bank_id", "transfer_date", "status"],
      limit: -1,
    }).catch(() => ({ rows: [] as Array<{ source_bank_id: number | null; transfer_date: string | null; status: string | null }> })),
    listItems<{ bank_account_id: number | null; direction: string | null; check_date: string | null; status: string | null }>(
      "bank_checks",
      { fields: ["bank_account_id", "direction", "check_date", "status"], limit: -1 },
    ).catch(() => ({ rows: [] as Array<{ bank_account_id: number | null; direction: string | null; check_date: string | null; status: string | null }> })),
  ]);

  for (const row of deposits.rows) {
    if (asString(row.status).toUpperCase() === "CANCELLED") continue;
    record(asNumber(row.target_bank_id), asString(row.deposit_date).slice(0, 10), "Deposit slip");
  }
  for (const row of transfers.rows) {
    if (asString(row.status).toUpperCase() === "CANCELLED") continue;
    record(asNumber(row.source_bank_id), asString(row.transfer_date).slice(0, 10), "Fund transfer");
  }
  for (const row of checks.rows) {
    if (asString(row.direction).toUpperCase() !== "ISSUED") continue;
    record(asNumber(row.bank_account_id), asString(row.check_date).slice(0, 10), "Issued check");
  }

  return activity;
}

async function loadLifecycle(): Promise<{ map: Map<number, Lifecycle>; notice?: string }> {
  try {
    const { rows } = await listItems<Record<string, unknown>>(ACCOUNTS, { fields: LIFECYCLE_FIELDS, limit: -1 });
    const map = new Map<number, Lifecycle>();
    for (const row of rows) {
      map.set(asNumber(row.bank_id), {
        dormantSince: asString(row.dormant_since) || null,
        escheatedAt: asString(row.escheated_at) || null,
        closedAt: asString(row.closed_at) || null,
        closureReason: asString(row.closure_reason) || null,
      });
    }
    return { map };
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    return {
      map: new Map(),
      notice:
        "Dormancy columns (dormant_since, escheated_at, closed_at, closure_reason) are not in bank_accounts yet. Run the dormancy DDL to record dormancy and closure dates.",
    };
  }
}

/** One shape for every dormancy route's failure response. */
export function describeDormancyError(error: unknown, context: string) {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { success: false, error: error.message, fieldErrors: error.field ? { [error.field]: [error.message] } : undefined },
    };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, body: { success: false, error: error.message } };
  }
  if (error instanceof PostingBlockedError) {
    return {
      status: 409,
      body: { success: false, error: error.message, missingMappingKeys: error.missingMappingKeys },
    };
  }
  console.error(context, error);
  return { status: 500, body: { success: false, error: "The dormancy action could not be completed." } };
}

export async function listDormancy(): Promise<{ accounts: DormancyAccount[]; notice?: string }> {
  const [accounts, depositTotals, disbursementTotals, activity, lifecycle] = await Promise.all([
    listItems<AccountRow>(ACCOUNTS, { fields: ACCOUNT_FIELDS, sort: "bank_name", limit: -1 }),
    loadDepositTotals(),
    loadDisbursementTotals(),
    loadActivity(),
    loadLifecycle(),
  ]);

  const today = phtToday();
  const rows = accounts.rows.map((row) => {
    const bankId = asNumber(row.bank_id);
    const status = statusOf(row);
    const life = lifecycle.map.get(bankId) ?? {
      dormantSince: null,
      escheatedAt: null,
      closedAt: null,
      closureReason: null,
    };
    const openingBalance = roundMoney(asNumber(row.opening_balance));
    const bookBalance = roundMoney(
      openingBalance + (depositTotals.get(bankId) ?? 0) - (disbursementTotals?.get(bankId) ?? 0),
    );

    const lastActivity = activity.get(bankId) ?? null;
    const anchor =
      (life.dormantSince ? asString(life.dormantSince).slice(0, 10) : null) ??
      lastActivity?.date ??
      asString(row.effective_date).slice(0, 10) ??
      asString(row.created_at).slice(0, 10);
    const monthsInactive = anchor ? monthsBetween(anchor, today) : 0;

    return {
      bankId,
      bankName: asString(row.bank_name),
      accountNumber: asString(row.account_number),
      accountName: asString(row.account_name) || null,
      accountType: asString(row.account_type) || null,
      branch: asString(row.branch) || null,
      currency: asString(row.currency).toUpperCase() === "USD" ? ("USD" as const) : ("PHP" as const),
      glCoaId: asNumber(row.gl_coa_id) || null,
      glCode: null,
      glTitle: null,
      status,
      bookBalance,
      lastCustomerActivity: lastActivity?.date ?? null,
      lastActivitySource: lastActivity?.source ?? null,
      monthsInactive,
      classification: classify(monthsInactive, status),
      dormantSince: life.dormantSince,
      escheatedAt: life.escheatedAt,
      closedAt: life.closedAt,
      closureReason: life.closureReason,
      retainUntil: asString(row.retain_until).slice(0, 10) || null,
    } satisfies DormancyAccount;
  });

  return { accounts: rows, notice: lifecycle.notice };
}

async function findAccount(bankId: number): Promise<DormancyAccount> {
  const { accounts } = await listDormancy();
  const account = accounts.find((entry) => entry.bankId === bankId);
  if (!account) throw new NotFoundError(`Bank account ${bankId} was not found.`);
  return account;
}

function accountLabel(account: DormancyAccount): string {
  return `${account.bankName} ${account.accountNumber}`.trim();
}

/** FSD §3.5 step 1 — every condition that must hold before an account may close. */
export async function preClosure(bankId: number): Promise<PreClosureResult> {
  const account = await findAccount(bankId);

  const [openChecks, openTransfers] = await Promise.all([
    listItems<{ id: number; check_no: string | null; status: string | null }>("bank_checks", {
      fields: ["id", "check_no", "status"],
      filter: { bank_account_id: { _eq: bankId }, status: { _in: ["PENDING", "RECEIVED", "IN_CLEARING"] } },
      limit: 50,
    }).catch(() => ({ rows: [] as Array<{ id: number; check_no: string | null; status: string | null }>, total: 0 })),
    listItems<{ transfer_id: number; transfer_no: string | null; status: string | null }>("bank_transfers", {
      fields: ["transfer_id", "transfer_no", "status"],
      filter: { source_bank_id: { _eq: bankId }, status: { _in: ["PREPARED", "PENDING"] } },
      limit: 50,
    }).catch(() => ({ rows: [] as Array<{ transfer_id: number; transfer_no: string | null; status: string | null }>, total: 0 })),
  ]);

  const checks: PreClosureCheck[] = [
    {
      key: "balance",
      label: "Book balance is 0.00",
      passed: account.bookBalance === 0,
      detail:
        account.bookBalance === 0
          ? "Nothing is left on the account."
          : `PHP ${account.bookBalance.toFixed(2)} is still on the book. Transfer it out in Cash & Bank Transactions first.`,
    },
    {
      key: "checks",
      label: "No check is Pending, Received or In Clearing",
      passed: openChecks.rows.length === 0,
      detail:
        openChecks.rows.length === 0
          ? "Every check on this account has settled."
          : `${openChecks.rows.length} check(s) still open: ${openChecks.rows
              .map((row) => asString(row.check_no) || `#${row.id}`)
              .join(", ")}. Clear them in Check & Clearing Management.`,
    },
    {
      key: "transfers",
      label: "No transfer is in clearing (GL 232100)",
      passed: openTransfers.rows.length === 0,
      detail:
        openTransfers.rows.length === 0
          ? "No transfer is awaiting its settlement leg."
          : `${openTransfers.rows.length} transfer(s) unsettled: ${openTransfers.rows
              .map((row) => asString(row.transfer_no) || `#${row.transfer_id}`)
              .join(", ")}. Settle them in Cash & Bank Transactions.`,
    },
    {
      key: "mandates",
      label: "No active auto-debit mandate",
      passed: true,
      unverified: true,
      detail:
        "This ERP keeps no auto-debit mandate register, so this test cannot pass or fail here. Confirm with the bank that no standing arrangement is live before closing.",
    },
  ];

  return {
    bankId,
    accountLabel: accountLabel(account),
    bookBalance: account.bookBalance,
    canClose: checks.every((entry) => entry.passed),
    checks,
  };
}

/** E16 — reclassify a dormant-eligible account to GL 201800 and mark it Dormant. */
export async function reclassifyDormant(bankId: number, userId: number | null): Promise<ActionOutcome> {
  const account = await findAccount(bankId);
  if (account.status !== "ACTIVE") {
    throw new ValidationError(`Only an active account can be reclassified; this one is ${account.status.toLowerCase()}.`);
  }
  if (account.classification !== "DORMANT_ELIGIBLE") {
    throw new ValidationError(
      `The account is ${account.classification.toLowerCase().replace("_", "-")}; reclassification needs ${DORMANT_MONTHS} months without customer activity.`,
    );
  }
  if (account.bookBalance <= 0) {
    throw new ValidationError("There is no remaining liability to reclassify.");
  }

  const entry = dormancyReclassEntry(account.bookBalance, {
    sourceRef: `BA-${account.bankId}`,
    postingDate: phtToday(),
    description: `Dormancy reclassification — ${accountLabel(account)}`,
  });

  const posted = await postJournalEntry(entry, userId);
  await updateItem(ACCOUNTS, bankId, {
    account_status: "DORMANT",
    dormant_since: phtStamp(),
    is_active: false,
  });

  return {
    message: `Account reclassified to GL 201800 as ${posted.jeNo}.`,
    journalNo: posted.jeNo,
    postingBlocked: false,
    missingMappingKeys: [],
  };
}

/**
 * P244 — the Treasury reference, the remittance date and the receiving agency are part of the
 * escheatment record. `bank_accounts` has no columns for them, so they are validated here and
 * carried on the E17 journal description, which is the audit trail the GL already keeps.
 */
function validateRemittance(input: EscheatRemittance | null | undefined): EscheatRemittance {
  const reference = input?.reference?.trim() ?? "";
  const remittedOn = input?.remittedOn?.trim() ?? "";
  const agency = input?.agency?.trim() ?? "";
  if (!reference) {
    throw new ValidationError("Enter the voucher or remittance reference from the Treasury.", "reference");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remittedOn)) {
    throw new ValidationError("Enter the date the dormant balance was remitted.", "remittedOn");
  }
  if (remittedOn > phtToday()) {
    throw new ValidationError("The remittance date cannot be in the future.", "remittedOn");
  }
  if (!agency) {
    throw new ValidationError("Enter the agency that received the escheated balance.", "agency");
  }
  return { reference, remittedOn, agency };
}

/** E17 — escheat a deposit that has been dormant for 10 years (Act No. 3936). */
export async function escheat(
  bankId: number,
  userId: number | null,
  remittance: EscheatRemittance | null | undefined,
): Promise<ActionOutcome> {
  // Request validation first: the P244 record is what makes an escheatment auditable, so a
  // missing reference or agency is reported before the account gates are examined.
  const remitted = validateRemittance(remittance);
  const account = await findAccount(bankId);
  if (account.status !== "DORMANT") {
    throw new ValidationError("Only a dormant account can be escheated.");
  }
  if (account.classification !== "ESCHEAT_ELIGIBLE") {
    throw new ValidationError(
      `Escheatment needs ${ESCHEAT_MONTHS} months dormant; this account is at ${account.monthsInactive}.`,
    );
  }
  if (account.bookBalance <= 0) {
    throw new ValidationError("There is no dormant balance to escheat.");
  }

  const entry = escheatEntry(account.bookBalance, {
    sourceRef: `BA-${account.bankId}`,
    postingDate: phtToday(),
    description: `Escheatment under Act No. 3936 — ${accountLabel(account)} · ref ${remitted.reference} · remitted ${remitted.remittedOn} · ${remitted.agency}`,
  });

  const posted = await postJournalEntry(entry, userId);
  const retainUntil = `${Number(phtToday().slice(0, 4)) + RETENTION_YEARS}${phtToday().slice(4)}`;
  // Escheatment is its own terminal state: the money belongs to the National Treasury, so the
  // account is frozen but not reported as an ordinary customer closure.
  await updateItem(ACCOUNTS, bankId, {
    account_status: "ESCHEATED",
    escheated_at: phtStamp(),
    closure_reason: "Dormant — escheated under Act No. 3936",
    retain_until: retainUntil.slice(0, 10),
    is_active: false,
  });

  return {
    message: `Dormant balance escheated to the National Treasury as ${posted.jeNo}. The account is frozen and reports as Escheated.`,
    journalNo: posted.jeNo,
    postingBlocked: false,
    missingMappingKeys: [],
  };
}

/**
 * Freeze an account without closing it. The closure checklist is reused, so a balance, an
 * open check or an unsettled transfer blocks it exactly as it would block a closure.
 * No journal entry and no actor column: deactivation moves no money.
 */
export async function deactivateAccount(bankId: number): Promise<ActionOutcome> {
  const account = await findAccount(bankId);
  if (account.status !== "ACTIVE" && account.status !== "DORMANT") {
    throw new ValidationError(`Only an active or dormant account can be deactivated; this one is ${account.status.toLowerCase()}.`);
  }

  const gate = await preClosure(bankId);
  const blockers = gate.checks.filter(
    (check) => (check.key === "balance" || check.key === "checks" || check.key === "transfers") && !check.passed,
  );
  if (blockers.length > 0) {
    throw new ValidationError(`The account cannot be deactivated yet. ${blockers.map((check) => check.detail).join(" ")}`);
  }

  await updateItem(ACCOUNTS, bankId, {
    account_status: "INACTIVE",
    is_active: false,
  });

  return {
    message: `${accountLabel(account)} deactivated. It is frozen until an administrator reactivates it.`,
    journalNo: null,
    postingBlocked: false,
    missingMappingKeys: [],
  };
}

/** E18 — accrued interest at the closing cut-off, 20% final tax, net payout. */
export async function planSettlement(bankId: number, input: SettlementInput): Promise<SettlementPlan> {
  const interest = roundMoney(input.accruedInterest);
  if (interest < 0) throw new ValidationError("Accrued interest cannot be negative.", "accruedInterest");
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.cutOff)) {
    throw new ValidationError("Enter the closing cut-off date.", "cutOff");
  }
  if (input.cutOff.slice(0, 10) > phtToday()) {
    throw new ValidationError("The closing cut-off cannot be in the future.", "cutOff");
  }

  const account = await findAccount(bankId);
  const tax = roundMoney(interest * FINAL_WHT_RATE);
  const netPayout = roundMoney(interest - tax);

  const entry = closureSettlementEntry(interest, tax, netPayout, {
    sourceRef: `BA-${account.bankId}`,
    postingDate: input.cutOff.slice(0, 10),
    description: `Closure settlement — ${accountLabel(account)}`,
  });

  return {
    accruedInterest: interest,
    taxRate: FINAL_WHT_RATE,
    taxAmount: tax,
    netPayout,
    draft: entry,
    preview: await resolveJournalEntry(entry),
  };
}

export async function settleClosure(
  bankId: number,
  input: SettlementInput,
  userId: number | null,
): Promise<ActionOutcome> {
  const gate = await preClosure(bankId);
  if (!gate.canClose) {
    throw new ValidationError("Closure is blocked until every pre-closure check passes.");
  }

  const plan = await planSettlement(bankId, input);
  if (plan.accruedInterest === 0) {
    return {
      message: "No accrued interest to settle; nothing was posted.",
      journalNo: null,
      postingBlocked: false,
      missingMappingKeys: [],
    };
  }

  try {
    const posted = await postJournalEntry(plan.draft, userId);
    return {
      message: `Closure settlement posted as ${posted.jeNo}.`,
      journalNo: posted.jeNo,
      postingBlocked: false,
      missingMappingKeys: [],
    };
  } catch (error) {
    if (error instanceof PostingBlockedError) {
      return {
        message: error.message,
        journalNo: null,
        postingBlocked: true,
        missingMappingKeys: error.missingMappingKeys,
      };
    }
    throw error;
  }
}

/** Step 3 — status lock. Closed is permanent and the records stay for 10 years. */
export async function lockClosed(
  bankId: number,
  reason: string,
  userId: number | null,
): Promise<ActionOutcome> {
  void userId;
  const account = await findAccount(bankId);
  if (account.status === "CLOSED") {
    throw new ValidationError("This account is already closed.");
  }
  const gate = await preClosure(bankId);
  if (!gate.canClose) {
    throw new ValidationError("Closure is blocked until every pre-closure check passes.");
  }
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new ValidationError("Give a closure reason of at least 5 characters.", "reason");

  const today = phtToday();
  const retainUntil = `${Number(today.slice(0, 4)) + RETENTION_YEARS}${today.slice(4, 10)}`;
  await updateItem(ACCOUNTS, bankId, {
    account_status: "CLOSED",
    closed_at: phtStamp(),
    closure_reason: trimmed,
    retain_until: retainUntil,
    is_active: false,
  });

  return {
    message: `Account closed. Records are retained until ${retainUntil}.`,
    journalNo: null,
    postingBlocked: false,
    missingMappingKeys: [],
  };
}
