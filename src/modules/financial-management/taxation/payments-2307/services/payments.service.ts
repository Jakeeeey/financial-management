import "server-only";

import { PERIOD_KEYS } from "../constants";
import { phtStamp } from "../pht";
import type { PaymentRow, PeriodKey } from "../types";
import type { Actor } from "./actor";
import { appendChangeLog, changedFields, formatValues } from "./changeLog";
import {
  asNumber,
  asString,
  createItem,
  deleteItem,
  getItem,
  isCollectionUnavailable,
  listItems,
  roundMoney,
  updateItem,
} from "./directus";
import { RowNotFoundError, ScopeMismatchError } from "./rowErrors";

const COLLECTION = "tax_payment";

const FIELDS = [
  "id",
  "company_id",
  "tax_year",
  "period_key",
  "form_code",
  "paid_on",
  "amount",
  "reference_no",
  "remarks",
  "created_at",
  "created_by",
];

const TRACKED_FIELDS = ["period_key", "form_code", "paid_on", "amount", "reference_no", "remarks"];

export interface PaymentInput {
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  formCode: string;
  paidOn: string;
  amount: number;
  referenceNo: string | null;
  remarks: string | null;
}

export interface PaymentLedger {
  payments: PaymentRow[];
  notices: string[];
}

function dateOnly(value: unknown): string {
  return asString(value).slice(0, 10);
}

function mapPayment(raw: Record<string, unknown>): PaymentRow {
  const period = asString(raw.period_key);
  return {
    id: asNumber(raw.id),
    companyId: asNumber(raw.company_id),
    taxYear: asNumber(raw.tax_year),
    periodKey: (PERIOD_KEYS as string[]).includes(period) ? (period as PeriodKey) : "ANNUAL",
    formCode: asString(raw.form_code),
    paidOn: dateOnly(raw.paid_on),
    amount: roundMoney(asNumber(raw.amount)),
    referenceNo: asString(raw.reference_no) || null,
    remarks: asString(raw.remarks) || null,
    createdAt: asString(raw.created_at),
    createdBy: raw.created_by == null ? null : asNumber(raw.created_by),
  };
}

export async function loadPayments(companyId: number, taxYear: number): Promise<PaymentLedger> {
  const notices: string[] = [];
  try {
    const { rows } = await listItems<Record<string, unknown>>(COLLECTION, {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: companyId } }, { tax_year: { _eq: taxYear } }] },
      sort: "-paid_on,-id",
      limit: -1,
    });
    return { payments: rows.map(mapPayment), notices };
  } catch (error) {
    notices.push(
      isCollectionUnavailable(error)
        ? "No payments are shown because table tax_payment is not readable yet (the schema may not be loaded)."
        : `Payments could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { payments: [], notices };
  }
}

function writePayload(input: PaymentInput): Record<string, unknown> {
  return {
    period_key: input.periodKey,
    form_code: input.formCode,
    paid_on: input.paidOn,
    amount: roundMoney(input.amount),
    reference_no: input.referenceNo,
    remarks: input.remarks,
  };
}

export async function createPayment(input: PaymentInput, actor: Actor): Promise<{ id: number }> {
  const created = await createItem<Record<string, unknown>>(COLLECTION, {
    company_id: input.companyId,
    tax_year: input.taxYear,
    ...writePayload(input),
    created_at: phtStamp(),
    created_by: actor.userId,
  });
  const id = asNumber(created.id);

  await appendChangeLog(
    {
      companyId: input.companyId,
      taxYear: input.taxYear,
      entity: "tax_payment",
      entityRef: String(id),
      field: "CREATED",
      beforeValue: null,
      afterValue: formatValues({
        form: input.formCode,
        period: input.periodKey,
        paid_on: input.paidOn,
        amount: roundMoney(input.amount),
      }),
      reason: null,
    },
    actor,
  );

  return { id };
}

export async function updatePayment(id: number, input: PaymentInput, actor: Actor): Promise<{ id: number }> {
  const existing = await getItem<Record<string, unknown>>(COLLECTION, id, FIELDS);
  if (!existing) throw new RowNotFoundError("payment", id);

  const before = mapPayment(existing);
  if (before.companyId !== input.companyId || before.taxYear !== input.taxYear) throw new ScopeMismatchError();

  await updateItem<Record<string, unknown>>(COLLECTION, id, writePayload(input));

  const changes = changedFields(
    {
      period_key: before.periodKey,
      form_code: before.formCode,
      paid_on: before.paidOn,
      amount: before.amount,
      reference_no: before.referenceNo,
      remarks: before.remarks,
    },
    writePayload(input),
    TRACKED_FIELDS,
  );

  for (const change of changes) {
    await appendChangeLog(
      {
        companyId: before.companyId,
        taxYear: before.taxYear,
        entity: "tax_payment",
        entityRef: String(id),
        field: change.field,
        beforeValue: change.beforeValue,
        afterValue: change.afterValue,
        reason: null,
      },
      actor,
    );
  }

  return { id };
}

export async function deletePayment(id: number, actor: Actor): Promise<{ id: number }> {
  const existing = await getItem<Record<string, unknown>>(COLLECTION, id, FIELDS);
  if (!existing) throw new RowNotFoundError("payment", id);

  const before = mapPayment(existing);
  await deleteItem(COLLECTION, id);
  await appendChangeLog(
    {
      companyId: before.companyId,
      taxYear: before.taxYear,
      entity: "tax_payment",
      entityRef: String(id),
      field: "DELETED",
      beforeValue: formatValues({
        form: before.formCode,
        period: before.periodKey,
        paid_on: before.paidOn,
        amount: before.amount,
        reference: before.referenceNo,
      }),
      afterValue: null,
      reason: null,
    },
    actor,
  );

  return { id };
}
