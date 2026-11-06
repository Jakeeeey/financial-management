import "server-only";

import type { DepositSlip, UndepositedAsset } from "../types";
import { daysSince, phtDisplayStamp, phtStamp, phtToday } from "../pht";
import { postJournalEntry, PostingBlockedError } from "./gl.service";
import {
  DirectusError,
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
const COLLECTION_FIELDS = ["id", "collection_date", "collection_receipt_no", "docNo"];
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

function isTruthyFlag(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
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
  const { rows: collections } = await listItems<{ id: number; collection_date: string | null; collection_receipt_no: string | null; docNo: string | null }>(
    "collection",
    { fields: COLLECTION_FIELDS, filter: { id: { _in: collectionIds } }, limit: 800 },
  );
  const byId = new Map(collections.map((row) => [Number(row.id), row]));

  return pending.map((row) => {
    const parent = row.collection_id == null ? undefined : byId.get(Number(row.collection_id));
    const collectionDate = parent?.collection_date ?? null;
    const isCash = Number(row.payment_method) === CASH;
    return {
      collectionDetailId: Number(row.id),
      collectionId: Number(row.collection_id ?? 0),
      documentNumber: parent?.collection_receipt_no || parent?.docNo || `#${row.collection_id ?? row.id}`,
      collectionReference: parent?.docNo ?? null,
      assetType: isCash ? "CASH" : "CHECK",
      customer: row.customer_code,
      bankName: row.bank,
      checkNo: row.check_no,
      chequeDate: row.chequeDate,
      collectionDate,
      amount: roundMoney(asNumber(row.amount)),
      ageDays: daysSince(collectionDate),
      alreadyDeposited: false,
    };
  });
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

export async function createDepositSlip(input: CreateSlipInput): Promise<CreateSlipResult> {
  if (!input.cashIds.length && !input.checkIds.length) {
    throw new ValidationError("Select at least one cash collection or check to deposit.");
  }
  if (input.depositDate > phtToday()) {
    throw new ValidationError("Deposit date cannot be in the future.");
  }

  const assets = await listUndepositedAssets();
  const byId = new Map(assets.map((asset) => [asset.collectionDetailId, asset]));

  const cash = input.cashIds.map((id) => byId.get(id)).filter((asset): asset is UndepositedAsset => !!asset && asset.assetType === "CASH");
  const checks = input.checkIds.map((id) => byId.get(id)).filter((asset): asset is UndepositedAsset => !!asset && asset.assetType === "CHECK");

  if (cash.length !== input.cashIds.length || checks.length !== input.checkIds.length) {
    throw new ValidationError("Some selected collections were already deposited or cleared. Refresh and try again.");
  }
  if (checks.some((check) => check.chequeDate && check.chequeDate > input.depositDate)) {
    throw new ValidationError("A post-dated check cannot be deposited before its check date.");
  }
  const oldest = [...cash, ...checks]
    .map((asset) => asset.collectionDate?.slice(0, 10))
    .filter((value): value is string => !!value)
    .sort()[0];
  if (oldest && input.depositDate < oldest) {
    throw new ValidationError("Deposit date cannot be earlier than the oldest selected collection date.");
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
  if (clash) throw new ValidationError("That slip or validation number is already used on this account.", "slipNo");

  const cashTotal = roundMoney(cash.reduce((sum, asset) => sum + asset.amount, 0));
  const checkTotal = roundMoney(checks.reduce((sum, asset) => sum + asset.amount, 0));
  const depositNo = await nextDepositNo();

  const created = await createItem<{ id: number }>("bank_deposit", {
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

  for (const asset of [...cash, ...checks]) {
    await createItem("bank_deposit_details", {
      bank_deposit_id: created.id,
      collection_detail_id: asset.collectionDetailId,
      deposit_status: "IN_TRANSIT",
    });
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
