import "server-only";

import type { DepositSlip, ResolvedJournalEntry, UndepositedAsset } from "../types";
import { daysSince, phtDisplayStamp, phtStamp, phtToday } from "../pht";
import { postJournalEntry, PostingBlockedError, resolveJournalEntry } from "./gl.service";
import {
  DirectusError,
  asBoolean,
  asNumber,
  asString,
  createItem,
  deleteItem,
  listItems,
  roundMoney,
  updateItem,
} from "./directus";
import { depositCancelEntry, depositCashEntry } from "../events";

/**
 * Bank Deposit reads and writes.
 *
 * Deposit slips already exist as `bank_deposit` + `bank_deposit_details`, and the
 * money waiting to be deposited is `collection_details` (payment_method 1 = cash,
 * 4 = check), so this service reuses them instead of a parallel model. The only new
 * rows are the checks created per deposited check, which feed Check & Clearing.
 */

const CASH = 1;
const CHECK = 4;

const DETAIL_FIELDS = [
  "id",
  "collection_id",
  "payment_method",
  "check_no",
  "chequeDate",
  "amount",
  "bank",
  "customer_code",
  "is_cleared",
];
const COLLECTION_FIELDS = ["id", "collection_date", "collection_receipt_no", "docNo", "isPosted", "isCancelled"];
const SLIP_FIELDS = [
  "id",
  "deposit_no",
  "deposit_date",
  "target_bank_id",
  "total_cash",
  "total_checks",
  "status",
  "prepared_by",
  "date_prepared",
  "deposit_reference_no",
  "cleared_at",
  "cleared_by",
  "remarks",
];
const ACCOUNT_FIELDS = ["bank_id", "bank_name", "account_number", "account_name"];

type DetailRow = {
  id: number;
  collection_id: number | null;
  payment_method: number | null;
  check_no: string | null;
  chequeDate: string | null;
  amount: number | string | null;
  bank: string | null;
  customer_code: string | null;
  is_cleared: unknown;
};

type SlipRow = {
  id: number;
  deposit_no: string;
  deposit_date: string;
  target_bank_id: number | null;
  total_cash: number | string | null;
  total_checks: number | string | null;
  status: string;
  prepared_by: string | null;
  date_prepared: string;
  deposit_reference_no: string | null;
  cleared_at: string | null;
  cleared_by: string | null;
  remarks: string | null;
};

export type DepositAccount = { bankId: number; label: string };

async function loadAccounts(): Promise<Map<number, string>> {
  const { rows } = await listItems<{ bank_id: number; bank_name: string | null; account_number: string | null; account_name: string | null }>(
    "bank_accounts",
    { fields: ACCOUNT_FIELDS, limit: 500 },
  );
  return new Map(
    rows.map((row) => [
      Number(row.bank_id),
      [row.bank_name, row.account_number].filter(Boolean).join(" · ") || `Account ${row.bank_id}`,
    ]),
  );
}

/**
 * `collection_details.bank` stores the `bank_names` id as text, so the register printed bare numbers
 * until this lookup. Missing ids fall back to the raw value rather than blanking the cell.
 */
async function loadBankNames(): Promise<Map<string, string>> {
  const { rows } = await listItems<{ id: number; bank_name: string | null }>("bank_names", {
    fields: ["id", "bank_name"],
    limit: 500,
  });
  return new Map(
    rows.filter((row) => row.bank_name).map((row) => [String(row.id), String(row.bank_name)]),
  );
}

function isTruthyFlag(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}

/**
 * `collection_details` stores only a customer code. The name lives in `customer`
 * (`customer_code` → `customer_name`), so the queue is readable without a second screen.
 */
async function loadCustomerNames(codes: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return new Map();
  const { rows } = await listItems<{ customer_code: string; customer_name: string | null }>("customer", {
    fields: ["customer_code", "customer_name"],
    filter: { customer_code: { _in: unique } },
    limit: 800,
  });
  return new Map(
    rows.filter((row) => asString(row.customer_name)).map((row) => [String(row.customer_code), asString(row.customer_name)]),
  );
}

/** Document numbers for rows that vanished from the queue, so a failure names them. */
async function describeMissing(detailIds: number[]): Promise<string> {
  if (!detailIds.length) return "the selected rows";
  try {
    const { rows: details } = await listItems<{ id: number; collection_id: number | null }>("collection_details", {
      fields: ["id", "collection_id"],
      filter: { id: { _in: detailIds } },
      limit: 200,
    });
    const collections = [...new Set(details.map((row) => Number(row.collection_id)).filter(Boolean))];
    const { rows } = collections.length
      ? await listItems<{ id: number; collection_receipt_no: string | null; docNo: string | null }>("collection", {
          fields: ["id", "collection_receipt_no", "docNo"],
          filter: { id: { _in: collections } },
          limit: 200,
        })
      : { rows: [] };
    const byId = new Map(rows.map((row) => [Number(row.id), row.collection_receipt_no || row.docNo]));
    const labels = details.map((row) => byId.get(Number(row.collection_id)) ?? `detail #${row.id}`);
    return labels.length ? labels.join(", ") : "the selected rows";
  } catch {
    return detailIds.map((id) => `detail #${id}`).join(", ");
  }
}

/** Cash and customer checks in the vault that are not on a live deposit slip yet. */
export async function listUndepositedAssets(): Promise<UndepositedAsset[]> {
  const [{ rows: details }, { rows: links }] = await Promise.all([
    listItems<DetailRow>("collection_details", {
      fields: DETAIL_FIELDS,
      filter: { payment_method: { _in: [CASH, CHECK] } },
      limit: 800,
    }),
    listItems<{ collection_detail_id: number | null; bank_deposit_id: number | null }>("bank_deposit_details", {
      fields: ["collection_detail_id", "bank_deposit_id"],
      limit: 800,
    }),
  ]);

  const deposited = new Set(links.map((link) => Number(link.collection_detail_id)));
  const pending = details.filter((row) => !isTruthyFlag(row.is_cleared) && !deposited.has(Number(row.id)));
  if (!pending.length) return [];

  const collectionIds = [...new Set(pending.map((row) => Number(row.collection_id)).filter(Boolean))];
  const { rows: collections } = await listItems<{
    id: number;
    collection_date: string | null;
    collection_receipt_no: string | null;
    docNo: string | null;
    isPosted: boolean | null;
    isCancelled: boolean | null;
  }>("collection", { fields: COLLECTION_FIELDS, filter: { id: { _in: collectionIds } }, limit: 800 });
  const byId = new Map(collections.map((row) => [Number(row.id), row]));
  const [bankNames, customerNames] = await Promise.all([
    loadBankNames(),
    loadCustomerNames(pending.map((row) => asString(row.customer_code))),
  ]);

  return pending.map((row) => {
    const parent = row.collection_id == null ? undefined : byId.get(Number(row.collection_id));
    const collectionDate = parent?.collection_date ?? null;
    const isCash = Number(row.payment_method) === CASH;
    const code = asString(row.customer_code) || null;
    const name = code ? customerNames.get(code) : undefined;
    return {
      collectionDetailId: Number(row.id),
      collectionId: Number(row.collection_id ?? 0),
      documentNumber: parent?.collection_receipt_no || parent?.docNo || `#${row.collection_id ?? row.id}`,
      collectionReference: parent?.docNo ?? null,
      assetType: isCash ? "CASH" : "CHECK",
      customer: name ?? code,
      customerCode: code,
      bankName: bankNames.get(asString(row.bank)) ?? asString(row.bank) ?? null,
      checkNo: row.check_no,
      chequeDate: row.chequeDate,
      collectionDate,
      amount: roundMoney(asNumber(row.amount)),
      ageDays: daysSince(collectionDate),
      alreadyDeposited: false,
      isPosted: parent?.isPosted === true,
      isCancelled: parent?.isCancelled === true,
    };
  });
}

/**
 * E07 preview for the create dialog. Nothing is written: the same resolver the posting path uses
 * runs on the cash total, so the panel cannot drift from what posting will actually do.
 */
export async function previewDepositSlip(input: { bankAccountId: number; cashTotal: number }): Promise<ResolvedJournalEntry> {
  return resolveJournalEntry(
    depositCashEntry({ bankId: input.bankAccountId, glCoaId: null }, roundMoney(input.cashTotal), {
      sourceRef: "PREVIEW",
      postingDate: phtToday(),
      description: "Cash deposit",
    }),
  );
}

export async function listDepositSlips(): Promise<DepositSlip[]> {
  const [{ rows }, accounts] = await Promise.all([
    listItems<SlipRow>("bank_deposit", { fields: SLIP_FIELDS, sort: "-deposit_date", limit: 400 }),
    loadAccounts(),
  ]);

  return rows.map((row) => ({
    id: Number(row.id),
    depositNo: row.deposit_no,
    depositDate: row.deposit_date,
    targetBankId: Number(row.target_bank_id ?? 0),
    targetBankLabel: accounts.get(Number(row.target_bank_id)) ?? "—",
    referenceNo: row.deposit_reference_no,
    validationFileId: null,
    status: row.status as DepositSlip["status"],
    totalCash: roundMoney(asNumber(row.total_cash)),
    totalChecks: roundMoney(asNumber(row.total_checks)),
    grandTotal: roundMoney(asNumber(row.total_cash) + asNumber(row.total_checks)),
    preparedBy: row.prepared_by,
    datePrepared: row.date_prepared,
    clearedAt: row.cleared_at ? phtDisplayStamp(row.cleared_at) : null,
    clearedBy: row.cleared_by,
    remarks: row.remarks,
  }));
}

export type CreateSlipInput = {
  bankAccountId: number;
  depositDate: string;
  slipNo: string;
  remarks: string | null;
  cashIds: number[];
  checkIds: number[];
};

export type CreateSlipResult = {
  slip: DepositSlip;
  postingBlocked: { message: string; missingMappingKeys: string[] } | null;
  notice: string | null;
};

function normalizeReference(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

async function nextDepositNo(): Promise<string> {
  const { rows } = await listItems<{ deposit_no: string }>("bank_deposit", {
    fields: ["deposit_no"],
    sort: "-deposit_no",
    limit: 1,
  });
  const current = rows[0]?.deposit_no ?? "";
  const digits = Number(current.replace(/\D/g, "")) || 0;
  return `DEP-${String(digits + 1).padStart(6, "0")}`;
}

/** Directus puts the useful sentence in the error body; surface it instead of "could not be saved". */
function describeDirectusWrite(error: DirectusError, what: string): string {
  try {
    const body = JSON.parse(error.body) as { errors?: { message?: string; extensions?: { field?: string } }[] };
    const first = body.errors?.[0];
    if (first?.message) {
      return `${what}: ${first.message}${first.extensions?.field ? ` (field ${first.extensions.field})` : ""}`;
    }
  } catch {
    // Not JSON; fall through to the status.
  }
  return `${what} was rejected by the database (HTTP ${error.status}).`;
}

export async function createDepositSlip(input: CreateSlipInput): Promise<CreateSlipResult> {
  if (!input.cashIds.length && !input.checkIds.length) {
    throw new ValidationError("Select at least one cash collection or check to deposit.");
  }
  if (input.depositDate > phtToday()) {
    throw new ValidationError("Deposit date cannot be in the future.");
  }

  // Only a live account can take money: frozen (INACTIVE), escheated, closed or dormant accounts are out.
  const { rows: targetRows } = await listItems<{ is_active: unknown; account_status: unknown }>("bank_accounts", {
    fields: ["is_active", "account_status"],
    filter: { bank_id: { _eq: input.bankAccountId } },
    limit: 1,
  });
  const target = targetRows[0];
  if (!target) {
    throw new NotFoundError(`Bank account ${input.bankAccountId} does not exist.`);
  }
  const targetStatus = asString(target.account_status) || (asBoolean(target.is_active) ? "ACTIVE" : "INACTIVE");
  if (!asBoolean(target.is_active) || targetStatus !== "ACTIVE") {
    throw new ValidationError(
      `Bank account ${input.bankAccountId} is ${targetStatus.toLowerCase()}; a deposit slip can only be prepared against an active account.`,
    );
  }

  const assets = await listUndepositedAssets();
  const byId = new Map(assets.map((asset) => [asset.collectionDetailId, asset]));

  const cash = input.cashIds.map((id) => byId.get(id)).filter((asset): asset is UndepositedAsset => !!asset && asset.assetType === "CASH");
  const checks = input.checkIds.map((id) => byId.get(id)).filter((asset): asset is UndepositedAsset => !!asset && asset.assetType === "CHECK");

  if (cash.length !== input.cashIds.length || checks.length !== input.checkIds.length) {
    const known = new Set(assets.map((asset) => asset.collectionDetailId));
    const missing = [...input.cashIds, ...input.checkIds].filter((id) => !known.has(id));
    throw new ValidationError(
      `These collections are no longer waiting to be deposited: ${await describeMissing(missing)}. Refresh and try again.`,
    );
  }

  const blocked = [...cash, ...checks].filter((asset) => asset.isCancelled || !asset.isPosted || !asset.collectionDate);
  if (blocked.length) {
    const names = blocked
      .map(
        (asset) =>
          `${asset.documentNumber}${asset.isCancelled ? " (voided)" : ""}${!asset.isPosted ? " (not posted)" : ""}${
            !asset.collectionDate ? " (no collected date)" : ""
          }`,
      )
      .join(", ");
    throw new ValidationError(`Post or date these collections before depositing them: ${names}.`);
  }

  const pdc = checks.filter((check) => check.chequeDate && check.chequeDate > input.depositDate);
  if (pdc.length) {
    const names = pdc
      .map((check) => `${check.documentNumber}${check.checkNo ? ` (check ${check.checkNo})` : ""}`)
      .join(", ");
    throw new ValidationError(`Deposit date is before the check date of ${names}.`);
  }
  const oldest = [...cash, ...checks]
    .map((asset) => asset.collectionDate?.slice(0, 10))
    .filter((value): value is string => !!value)
    .sort()[0];
  if (oldest && input.depositDate < oldest) {
    const earliest = [...cash, ...checks]
      .filter((asset) => asset.collectionDate?.slice(0, 10) === oldest)
      .map((asset) => asset.documentNumber)
      .join(", ");
    throw new ValidationError(`Deposit date cannot be earlier than ${oldest}, the collection date of ${earliest}.`);
  }

  const { rows: existing } = await listItems<{ id: number; deposit_reference_no: string | null; status: string }>("bank_deposit", {
    fields: ["id", "deposit_reference_no", "status"],
    filter: { target_bank_id: { _eq: input.bankAccountId } },
    limit: 500,
  });
  const wanted = normalizeReference(input.slipNo);
  const clash = existing.some(
    (row) => row.status !== "CANCELLED" && normalizeReference(row.deposit_reference_no ?? "") === wanted,
  );
  if (clash) {
    throw new ValidationError(`Slip / validation no. "${input.slipNo}" is already used on this account.`, "slipNo");
  }

  const cashTotal = roundMoney(cash.reduce((sum, asset) => sum + asset.amount, 0));
  const checkTotal = roundMoney(checks.reduce((sum, asset) => sum + asset.amount, 0));
  const depositNo = await nextDepositNo();

  let created: { id: number };
  try {
    created = await createItem<{ id: number }>("bank_deposit", {
      deposit_no: depositNo,
      deposit_date: input.depositDate,
      target_bank_id: input.bankAccountId,
      total_cash: cashTotal,
      total_checks: checkTotal,
      status: "PREPARED",
      date_prepared: phtStamp(),
      deposit_reference_no: input.slipNo,
      remarks: input.remarks,
    });
  } catch (error) {
    if (error instanceof DirectusError) {
      throw new ValidationError(describeDirectusWrite(error, `Deposit slip ${input.slipNo}`));
    }
    throw error;
  }

  try {
    for (const asset of [...cash, ...checks]) {
      await createItem("bank_deposit_details", {
        bank_deposit_id: created.id,
        collection_detail_id: asset.collectionDetailId,
        deposit_status: "IN_TRANSIT",
      });
    }
  } catch (error) {
    if (error instanceof DirectusError) {
      throw new ValidationError(
        `${describeDirectusWrite(error, `Deposit slip ${depositNo} was saved but a collection could not be attached`)}. Remove the slip before retrying.`,
      );
    }
    throw error;
  }

  let notice: string | null = null;
  let postingBlocked: CreateSlipResult["postingBlocked"] = null;

  try {
    for (const check of checks) {
      await createItem("bank_checks", {
        bank_account_id: input.bankAccountId,
        direction: "RECEIVED",
        check_no: check.checkNo ?? `DEP-${check.collectionDetailId}`,
        check_date: check.chequeDate ?? input.depositDate,
        amount: check.amount,
        drawee_bank: check.bankName,
        payor: check.customer,
        status: "IN_CLEARING",
        is_pdc: 0,
        source_type: "COLLECTIONS",
        source_ref: depositNo,
        collection_detail_id: check.collectionDetailId,
        created_at: phtStamp(),
      });
    }
  } catch (error) {
    if (error instanceof DirectusError) {
      notice = "Checks were added to the slip but the check register is not available yet, so clearing cannot be tracked.";
    } else {
      throw error;
    }
  }

  if (cashTotal > 0) {
    try {
      await postJournalEntry(
        depositCashEntry(
          { bankId: input.bankAccountId, glCoaId: null },
          cashTotal,
          {
            sourceRef: depositNo,
            postingDate: input.depositDate,
            description: `Bank deposit ${depositNo} (${input.slipNo})`,
          },
        ),
        null,
      );
    } catch (error) {
      if (error instanceof PostingBlockedError) {
        postingBlocked = { message: error.message, missingMappingKeys: error.missingMappingKeys };
      } else {
        throw error;
      }
    }
  }

  const [slip] = (await listDepositSlips()).filter((row) => row.id === created.id);
  return { slip, postingBlocked, notice };
}

export async function cancelDepositSlip(slipId: number, reason: string): Promise<DepositSlip> {
  const { rows } = await listItems<SlipRow>("bank_deposit", { fields: SLIP_FIELDS, filter: { id: { _eq: slipId } }, limit: 1 });
  const slip = rows[0];
  if (!slip) throw new NotFoundError("Deposit slip not found.");
  if (slip.status === "CANCELLED") throw new ValidationError("This slip is already cancelled.");
  if (slip.status === "CLEARED") throw new ValidationError("A cleared slip cannot be cancelled.");

  const { rows: links } = await listItems<{ id: number; collection_detail_id: number | null }>("bank_deposit_details", {
    fields: ["id", "collection_detail_id"],
    filter: { bank_deposit_id: { _eq: slipId } },
    limit: 200,
  });
  const detailIds = links.map((link) => Number(link.collection_detail_id)).filter(Boolean);

  let checkIds: number[] = [];
  if (detailIds.length) {
    try {
      const { rows: checks } = await listItems<{ id: number; status: string }>("bank_checks", {
        fields: ["id", "status"],
        filter: { collection_detail_id: { _in: detailIds }, direction: { _eq: "RECEIVED" } },
        limit: 200,
      });
      const blocking = checks.filter((check) => check.status !== "IN_CLEARING");
      if (blocking.length) {
        throw new ValidationError("A check on this slip has already cleared or been returned, so the slip cannot be cancelled.");
      }
      checkIds = checks.map((check) => Number(check.id));
    } catch (error) {
      if (error instanceof DirectusError) {
        // The check register does not exist yet, so there is nothing to validate against.
      } else {
        throw error;
      }
    }
  }

  const cashTotal = roundMoney(asNumber(slip.total_cash));
  if (cashTotal > 0) {
    await postJournalEntry(
      depositCancelEntry(
        { bankId: Number(slip.target_bank_id ?? 0), glCoaId: null },
        cashTotal,
        {
          sourceRef: slip.deposit_no,
          postingDate: phtToday(),
          description: `Deposit slip ${slip.deposit_no} cancelled — ${reason}`,
        },
      ),
      null,
    );
  }

  for (const checkId of checkIds) {
    await updateCheckBackToVault(checkId);
  }
  for (const link of links) {
    await deleteItem("bank_deposit_details", link.id);
  }

  await updateItemStatus(slipId);

  const [cancelled] = (await listDepositSlips()).filter((row) => row.id === slipId);
  return cancelled;
}

async function updateCheckBackToVault(checkId: number) {
  await updateItem("bank_checks", checkId, {
    status: "RECEIVED",
    deposited_at: null,
    updated_at: phtStamp(),
  });
}

async function updateItemStatus(slipId: number) {
  await updateItem("bank_deposit", slipId, { status: "CANCELLED" });
}

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

export function assetLabel(asset: UndepositedAsset): string {
  return asset.assetType === "CASH"
    ? `Cash · ${asset.documentNumber}`
    : `Check ${asString(asset.checkNo) || "—"} · ${asset.bankName ?? "—"}`;
}
