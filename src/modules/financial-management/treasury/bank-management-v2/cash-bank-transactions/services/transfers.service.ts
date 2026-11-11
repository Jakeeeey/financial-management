import "server-only";

import { accountGlKey, transferEntry } from "../events";
import { phtDate, phtStamp, phtTime } from "../pht";
import type { TransferBody } from "../schemas";
import { getAccount } from "./accounts.service";
import { asNumber, asString, createItem, DirectusError, getItem, listItems, roundMoney, updateItem } from "./directus";
import { NotFoundError, ValidationError } from "./errors";
import { postJournalEntry } from "./gl.service";
import { findSourceEntry, isMissingItem } from "./repost.service";

/**
 * Fund transfers: E05 when the value date is today, E06 when it is later.
 *
 * A later value date parks the money in transfer-in-transit (leg 1) and leaves the row PENDING;
 * settling on or after the value date moves it into the destination account (leg 2).
 */

const TRANSFERS = "bank_transfers";
const PAYMENT_METHODS = "payment_methods";

type TransferRow = Record<string, unknown>;

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
  "remarks",
];

/** PHT wall clock, the shape the DDL stores. */
function storedStamp(): string {
  return phtStamp().replace("T", " ");
}

export async function createTransfer(
  body: TransferBody,
  userId: number | null,
): Promise<{ transferNo: string; jeNo: string; status: string }> {
  const [from, to] = await Promise.all([getAccount(body.sourceBankId), getAccount(body.destinationBankId)]);
  if (!from) throw new NotFoundError("The source account could not be found.", );
  if (!to) throw new NotFoundError("The destination account could not be found.");

  const amount = roundMoney(body.amount);
  const fee = roundMoney(body.transferFee ?? 0);
  const valueDateIsLater = body.valueDate > phtDate();
  const transferNo = nextTransferNo();
  const remarks = (body.remarks ?? "").trim();

  const draft = transferEntry("OUT", from, to, amount, valueDateIsLater, {
    // bank_journal_entries is unique on (source_ref, event_code), and both legs post the
    // same E06 for a later value date: each leg needs its own source ref or leg 2 is refused.
    sourceRef: `${transferNo}-L1`,
    postingDate: body.valueDate,
    description: remarks || `Fund transfer ${transferNo}`,
  });

  if (fee > 0) {
    // ponytail: the fee rides in the same E05/E06 entry as a BANK_CHARGES_EXPENSE debit and raises
    // the source credit, so one transfer costs one journal number instead of two entries. Split it
    // into its own E03 entry if the bank starts billing the fee separately.
    draft.lines = [
      draft.lines[0],
      { mappingKey: accountGlKey(from), debit: 0, credit: roundMoney(amount + fee), memo: "Transfer sent" },
      { mappingKey: "BANK_CHARGES_EXPENSE", debit: fee, credit: 0, memo: "Transfer fee" },
    ];
  }

  const entry = await postJournalEntry(draft, userId);
  const transactionType = await resolveTransactionType();

  const payload: Record<string, unknown> = {
    transfer_no: transferNo,
    reference_number: transferNo,
    transfer_date: phtDate(),
    value_date: body.valueDate,
    source_bank_id: from.bankId,
    destination_bank_id: to.bankId,
    amount,
    transfer_fee: fee,
    status: valueDateIsLater ? "PENDING" : "COMPLETED",
    prepared_by: userId,
    date_prepared: storedStamp(),
    remarks: remarks || null,
    journal_entry_id: entry.id,
  };
  if (transactionType !== null) payload.transaction_type = transactionType;
  if (!valueDateIsLater) payload.settled_at = storedStamp();

  try {
    await createItem(TRANSFERS, payload);
  } catch (error) {
    // No cross-collection transaction in the REST API: mirror the entry so the ledger does not
    // keep a transfer that has no row.
    await postJournalEntry(
      {
        ...draft,
        eventCode: `${draft.eventCode}R`,
        sourceRef: `${transferNo}-L1`,
        description: `Reversal of ${entry.jeNo} — ${draft.description}`,
        lines: draft.lines.map((line) => ({
          mappingKey: line.mappingKey,
          debit: line.credit,
          credit: line.debit,
          memo: line.memo,
        })),
      },
      userId,
      entry.jeNo,
    ).catch((reversalError: unknown) => {
      console.error("[cash-bank-transactions] transfer insert failed and the reversal failed", error, reversalError);
    });
    throw error;
  }

  return {
    transferNo,
    jeNo: entry.jeNo,
    status: valueDateIsLater ? "PENDING" : "COMPLETED",
  };
}

/** Posts E06 leg 2 for a transfer whose value date has arrived. */
export async function settleTransfer(
  transferId: number,
  note: string | null,
  userId: number | null,
): Promise<{ id: number; status: string; jeNo: string }> {
  const row = await getItem<TransferRow>(TRANSFERS, transferId, TRANSFER_FIELDS);
  if (!row) throw new NotFoundError("That transfer could not be found.");
  if (asString(row.status).toUpperCase() !== "PENDING") {
    throw new ValidationError("Only a transfer in clearing can be settled.");
  }

  const valueDate = asString(row.value_date) || asString(row.transfer_date);
  if (valueDate > phtDate()) {
    throw new ValidationError(`This transfer settles on ${valueDate}. Settle it on or after that date.`);
  }

  const [from, to] = await Promise.all([
    getAccount(asNumber(row.source_bank_id)),
    getAccount(asNumber(row.destination_bank_id)),
  ]);
  if (!from || !to) throw new ValidationError("One of the accounts on this transfer no longer exists.");

  const transferNo = asString(row.transfer_no);
  const amount = roundMoney(asNumber(row.amount));
  const entry = await postJournalEntry(
    transferEntry("IN", from, to, amount, true, {
      sourceRef: `${transferNo}-L2`,
      postingDate: phtDate(),
      description: note?.trim() || `Fund transfer ${transferNo} settled`,
    }),
    userId,
  );

  const remarks = [asString(row.remarks), note?.trim()].filter(Boolean).join(" | ").slice(0, 2000);
  await updateItem(TRANSFERS, transferId, {
    status: "COMPLETED",
    settled_at: storedStamp(),
    journal_entry_id: entry.id,
    remarks: remarks || null,
  });

  return { id: transferId, status: "COMPLETED", jeNo: entry.jeNo };
}

/**
 * Posts the entry a saved transfer is missing. Leg 1 when the row is still in clearing or was
 * never settled; leg 2 when it settled and that entry is gone. Same idempotency rule as memos:
 * the unique index on (source_ref, event_code) decides, not a stored id.
 */
export async function repostTransferEntry(
  transferId: number,
  userId: number | null,
): Promise<{ id: number; jeNo: string; eventCode: string; lines: number }> {
  let row: TransferRow | null;
  try {
    row = await getItem<TransferRow>(TRANSFERS, transferId, [...TRANSFER_FIELDS, "settled_at", "journal_entry_id"]);
  } catch (readError) {
    if (!isMissingItem(readError)) throw readError;
    row = null;
  }
  if (!row) throw new NotFoundError("That transfer could not be found.");

  const status = asString(row.status).toUpperCase();
  if (status === "CANCELLED") throw new ValidationError("A cancelled transfer cannot be posted again.");

  const [from, to] = await Promise.all([
    getAccount(asNumber(row.source_bank_id)),
    getAccount(asNumber(row.destination_bank_id)),
  ]);
  if (!from || !to) throw new ValidationError("One of the accounts on this transfer no longer exists.");

  const transferNo = asString(row.transfer_no);
  const amount = roundMoney(asNumber(row.amount));
  const fee = roundMoney(asNumber(row.transfer_fee));
  const remarks = asString(row.remarks);
  const valueDate = asString(row.value_date) || asString(row.transfer_date);
  const settled = status === "COMPLETED" && Boolean(asString(row.settled_at));

  const draft = settled
    ? transferEntry("IN", from, to, amount, true, {
        sourceRef: `${transferNo}-L2`,
        postingDate: phtDate(),
        description: remarks || `Fund transfer ${transferNo} settled`,
      })
    : transferEntry("OUT", from, to, amount, valueDate > asString(row.transfer_date), {
        sourceRef: `${transferNo}-L1`,
        postingDate: valueDate,
        description: remarks || `Fund transfer ${transferNo}`,
      });

  if (!settled && fee > 0) {
    draft.lines = [
      draft.lines[0],
      { mappingKey: accountGlKey(from), debit: 0, credit: roundMoney(amount + fee), memo: "Transfer sent" },
      { mappingKey: "BANK_CHARGES_EXPENSE", debit: fee, credit: 0, memo: "Transfer fee" },
    ];
  }

  const existing = await findSourceEntry(draft.sourceRef, draft.eventCode);
  if (existing) throw new ValidationError(`This transfer already has journal entry ${existing}.`);

  const entry = await postJournalEntry(draft, userId);
  await updateItem(TRANSFERS, transferId, { journal_entry_id: entry.id });

  return { id: transferId, jeNo: entry.jeNo, eventCode: entry.eventCode, lines: entry.lines.length };
}

/** Transfers parked in clearing whose value date has arrived. */
function dueFilter() {
  return { _and: [{ status: { _eq: "PENDING" } }, { value_date: { _lte: phtDate() } }] };
}

export async function countDueTransfers(): Promise<number> {
  try {
    const { total } = await listItems<TransferRow>(TRANSFERS, { fields: ["transfer_id"], filter: dueFilter(), limit: 1 });
    return total;
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    return 0;
  }
}

export type SettleDueResult = {
  settled: number;
  jeNos: string[];
  failed: Array<{ id: number; transferNo: string; error: string }>;
};

/** The settle-many path: every due transfer, leg 2 each, one failure never stops the rest. */
export async function settleDueTransfers(userId: number | null): Promise<SettleDueResult> {
  const { rows } = await listItems<TransferRow>(TRANSFERS, {
    fields: ["transfer_id", "transfer_no"],
    filter: dueFilter(),
    sort: "value_date",
    limit: 100,
  });

  const result: SettleDueResult = { settled: 0, jeNos: [], failed: [] };
  for (const row of rows) {
    const id = asNumber(row.transfer_id);
    try {
      const settled = await settleTransfer(id, null, userId);
      result.settled += 1;
      result.jeNos.push(settled.jeNo);
    } catch (error) {
      result.failed.push({
        id,
        transferNo: asString(row.transfer_no),
        error: error instanceof Error ? error.message : "The transfer could not be settled.",
      });
    }
  }
  return result;
}

/** `BT-YYYYMMDD-HHmmss`, the shape the legacy column and screens expect. */
function nextTransferNo(): string {
  return `BT-${phtDate().replace(/-/g, "")}-${phtTime().replace(/:/g, "")}`;
}

/**
 * `transaction_type` is a legacy NOT NULL column that carries no accounting meaning here: the
 * dialog has no payment-method field, so the first configured method is used as the placeholder.
 */
async function resolveTransactionType(): Promise<number | null> {
  try {
    const { rows } = await listItems<{ method_id: number }>(PAYMENT_METHODS, {
      fields: ["method_id"],
      sort: "method_id",
      limit: 1,
    });
    return rows.length ? asNumber(rows[0].method_id) || null : null;
  } catch (error) {
    if (!(error instanceof DirectusError)) throw error;
    console.warn(`[cash-bank-transactions] payment methods unavailable: ${error.status}`);
    return null;
  }
}
