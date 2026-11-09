import "server-only";

import {
  DIRECTIONS,
  MATCH_TOLERANCE,
  PERIOD_KEYS,
  QUARTER_KEYS,
  isQuarterPast,
  quarterOf,
} from "../constants";
import { phtStamp, phtToday } from "../pht";
import type {
  CertificateDirection,
  CertificateRow,
  CertificateSource,
  CertificateStatus,
  ExpectedPeriod,
  PeriodKey,
  PrefillResult,
  PrefillRow,
  RegistryCompany,
  WithholdingIncomeType,
} from "../types";
import type { Actor } from "./actor";
import { appendChangeLog, changedFields, formatValues } from "./changeLog";
import { CompanyRequestError, groupedByDate, listRows } from "./companyClient";
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

const COLLECTION = "tax_2307";

const FIELDS = [
  "id",
  "company_id",
  "tax_year",
  "period_key",
  "direction",
  "counterparty_company_id",
  "counterparty_name",
  "counterparty_tin",
  "income_type",
  "income_amount",
  "tax_rate",
  "tax_withheld",
  "date_received",
  "source",
  "source_ref",
  "remarks",
  "created_at",
  "created_by",
];

const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

const TRACKED_FIELDS = [
  "period_key",
  "direction",
  "counterparty_company_id",
  "counterparty_name",
  "counterparty_tin",
  "income_type",
  "income_amount",
  "tax_rate",
  "tax_withheld",
  "date_received",
  "remarks",
];

export interface CertificateInput {
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  direction: CertificateDirection;
  counterpartyCompanyId: number | null;
  counterpartyName: string;
  counterpartyTin: string | null;
  incomeType: WithholdingIncomeType;
  incomeAmount: number;
  taxRate: number;
  taxWithheld: number;
  dateReceived: string | null;
  remarks: string | null;
}

export interface CertificateLedger {
  certificates: CertificateRow[];
  expected: ExpectedPeriod[];
  notices: string[];
}

function describe(error: unknown): string {
  if (error instanceof CompanyRequestError || error instanceof Error) return error.message;
  return String(error);
}

function asPeriodKey(value: string): PeriodKey {
  return (PERIOD_KEYS as string[]).includes(value) ? (value as PeriodKey) : "ANNUAL";
}

function asDirection(value: string): CertificateDirection {
  return value === "ISSUED" ? "ISSUED" : "RECEIVED";
}

function asIncomeType(value: string): WithholdingIncomeType {
  const known: WithholdingIncomeType[] = ["RENT", "FEE", "SERVICES", "CONSTRUCTION", "GOODS", "OTHER"];
  return known.includes(value as WithholdingIncomeType) ? (value as WithholdingIncomeType) : "OTHER";
}

function asSource(value: string): CertificateSource {
  return value === "SALES_INVOICE" || value === "PURCHASE_ORDER" ? value : "MANUAL";
}

function dateOnly(value: unknown): string | null {
  const text = asString(value);
  return text ? text.slice(0, 10) : null;
}

function mapCertificate(raw: Record<string, unknown>): Omit<CertificateRow, "status"> {
  return {
    id: asNumber(raw.id),
    companyId: asNumber(raw.company_id),
    taxYear: asNumber(raw.tax_year),
    periodKey: asPeriodKey(asString(raw.period_key)),
    direction: asDirection(asString(raw.direction)),
    counterpartyCompanyId: raw.counterparty_company_id == null ? null : asNumber(raw.counterparty_company_id),
    counterpartyName: asString(raw.counterparty_name),
    counterpartyTin: asString(raw.counterparty_tin) || null,
    incomeType: asIncomeType(asString(raw.income_type)),
    incomeAmount: roundMoney(asNumber(raw.income_amount)),
    taxRate: roundMoney(asNumber(raw.tax_rate)),
    taxWithheld: roundMoney(asNumber(raw.tax_withheld)),
    dateReceived: dateOnly(raw.date_received),
    source: asSource(asString(raw.source)),
    sourceRef: asString(raw.source_ref) || null,
    remarks: asString(raw.remarks) || null,
    createdAt: asString(raw.created_at),
    createdBy: raw.created_by == null ? null : asNumber(raw.created_by),
  };
}

/**
 * Matched / Short / Over compare the period's whole certificate total against the
 * ledger figure, because one period can hold several certificates and comparing each
 * one to the total would flag every row of a two-payee quarter.
 */
export function deriveStatus(input: {
  expected: number;
  recorded: number;
  count: number;
  known: boolean;
  past: boolean;
}): CertificateStatus {
  if (!input.known) return "UNKNOWN";
  if (input.count === 0) return input.past ? "NOT_ENTERED" : "UPCOMING";
  const difference = roundMoney(input.recorded - input.expected);
  if (Math.abs(difference) <= MATCH_TOLERANCE) return "MATCHED";
  return difference < 0 ? "SHORT" : "OVER";
}

interface ExpectedLedger {
  received: number[];
  issued: number[];
  receivedKnown: boolean;
  issuedKnown: boolean;
}

/** What the company's own invoices say each quarter should have been withheld. */
async function loadExpectedLedger(
  company: RegistryCompany,
  taxYear: number,
  notices: string[],
): Promise<ExpectedLedger> {
  const ledger: ExpectedLedger = {
    received: [0, 0, 0, 0],
    issued: [0, 0, 0, 0],
    receivedKnown: false,
    issuedKnown: false,
  };
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;

  try {
    const rows = await groupedByDate(
      company.baseUrl,
      company.token,
      company.code,
      "sales_invoice",
      "invoice_date",
      { ewt_amount: "sum" },
      from,
      to,
      { transaction_status: { _nin: CANCELLED_SALES } },
    );
    for (const row of rows) {
      const index = quarterOf(row.date);
      if (index === null) continue;
      ledger.received[index] += row.sums.ewt_amount ?? 0;
    }
    ledger.receivedKnown = true;
  } catch (error) {
    notices.push(
      `Sales invoices could not be read, so received certificates are shown as "Not compared": ${describe(error)}`,
    );
  }

  try {
    const rows = await groupedByDate(
      company.baseUrl,
      company.token,
      company.code,
      "purchase_order",
      "date",
      { withholding_tax_amount: "sum" },
      from,
      to,
    );
    for (const row of rows) {
      const index = quarterOf(row.date);
      if (index === null) continue;
      ledger.issued[index] += row.sums.withholding_tax_amount ?? 0;
    }
    ledger.issuedKnown = true;
  } catch (error) {
    notices.push(
      `Purchase orders have no withholding column this desk can read, so issued certificates are shown as "Not compared": ${describe(error)}`,
    );
  }

  for (let index = 0; index < 4; index += 1) {
    ledger.received[index] = roundMoney(ledger.received[index]);
    ledger.issued[index] = roundMoney(ledger.issued[index]);
  }
  return ledger;
}

function buildExpected(
  certificates: Array<Omit<CertificateRow, "status">>,
  ledger: ExpectedLedger,
  taxYear: number,
  today: string,
): ExpectedPeriod[] {
  const periods: ExpectedPeriod[] = [];

  for (const direction of DIRECTIONS) {
    const known = direction === "RECEIVED" ? ledger.receivedKnown : ledger.issuedKnown;
    const quarters = direction === "RECEIVED" ? ledger.received : ledger.issued;
    const yearTotal = roundMoney(quarters.reduce((sum, value) => sum + value, 0));
    const yearPast = isQuarterPast(taxYear, 3, today);

    for (const periodKey of PERIOD_KEYS) {
      const quarterIndex = QUARTER_KEYS.indexOf(periodKey);
      const expected = periodKey === "ANNUAL" ? yearTotal : (quarters[quarterIndex] ?? 0);
      const matching = certificates.filter(
        (certificate) => certificate.periodKey === periodKey && certificate.direction === direction,
      );
      const recorded = roundMoney(matching.reduce((sum, certificate) => sum + certificate.taxWithheld, 0));
      const past = periodKey === "ANNUAL" ? yearPast : isQuarterPast(taxYear, quarterIndex, today);

      periods.push({
        periodKey,
        direction,
        expected,
        recorded,
        certificateCount: matching.length,
        status: deriveStatus({ expected, recorded, count: matching.length, known, past }),
        known,
      });
    }
  }

  return periods;
}

export async function loadCertificateLedger(
  company: RegistryCompany | null,
  companyId: number,
  taxYear: number,
): Promise<CertificateLedger> {
  const notices: string[] = [];
  let base: Array<Omit<CertificateRow, "status">> = [];

  try {
    const { rows } = await listItems<Record<string, unknown>>(COLLECTION, {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: companyId } }, { tax_year: { _eq: taxYear } }] },
      sort: "period_key,direction,counterparty_name",
      limit: -1,
    });
    base = rows.map(mapCertificate);
  } catch (error) {
    notices.push(
      isCollectionUnavailable(error)
        ? "The 2307 register is empty because table tax_2307 is not readable yet (the schema may not be loaded). Add nothing here until it is."
        : `The 2307 register could not be read: ${describe(error)}`,
    );
  }

  if (!company) {
    notices.push(`Company ${companyId} is not in the registry, so expected withholding cannot be read.`);
    const expected = buildExpected(base, {
      received: [0, 0, 0, 0],
      issued: [0, 0, 0, 0],
      receivedKnown: false,
      issuedKnown: false,
    }, taxYear, phtToday());
    return { certificates: base.map((row) => ({ ...row, status: "UNKNOWN" })), expected, notices };
  }

  const ledger = await loadExpectedLedger(company, taxYear, notices);
  const expected = buildExpected(base, ledger, taxYear, phtToday());
  const statusByPeriod = new Map(expected.map((period) => [`${period.direction}|${period.periodKey}`, period.status]));

  return {
    certificates: base.map((row) => ({
      ...row,
      status: statusByPeriod.get(`${row.direction}|${row.periodKey}`) ?? "UNKNOWN",
    })),
    expected,
    notices,
  };
}

function writePayload(input: CertificateInput): Record<string, unknown> {
  return {
    period_key: input.periodKey,
    direction: input.direction,
    counterparty_company_id: input.counterpartyCompanyId,
    counterparty_name: input.counterpartyName,
    counterparty_tin: input.counterpartyTin,
    income_type: input.incomeType,
    income_amount: roundMoney(input.incomeAmount),
    tax_rate: roundMoney(input.taxRate),
    tax_withheld: roundMoney(input.taxWithheld),
    date_received: input.dateReceived,
    remarks: input.remarks,
  };
}

export async function createCertificate(input: CertificateInput, actor: Actor): Promise<{ id: number }> {
  const created = await createItem<Record<string, unknown>>(COLLECTION, {
    company_id: input.companyId,
    tax_year: input.taxYear,
    ...writePayload(input),
    source: "MANUAL",
    source_ref: null,
    created_at: phtStamp(),
    created_by: actor.userId,
  });

  const id = asNumber(created.id);
  await appendChangeLog(
    {
      companyId: input.companyId,
      taxYear: input.taxYear,
      entity: "tax_2307",
      entityRef: String(id),
      field: "CREATED",
      beforeValue: null,
      afterValue: formatValues({
        direction: input.direction,
        period: input.periodKey,
        counterparty: input.counterpartyName,
        withheld: roundMoney(input.taxWithheld),
      }),
      reason: null,
    },
    actor,
  );

  return { id };
}

export async function updateCertificate(
  id: number,
  input: CertificateInput,
  actor: Actor,
): Promise<{ id: number }> {
  const existing = await getItem<Record<string, unknown>>(COLLECTION, id, FIELDS);
  if (!existing) throw new RowNotFoundError("2307 certificate", id);

  const before = mapCertificate(existing);
  if (before.companyId !== input.companyId || before.taxYear !== input.taxYear) throw new ScopeMismatchError();

  await updateItem<Record<string, unknown>>(COLLECTION, id, writePayload(input));

  const beforeValues: Record<string, unknown> = {
    period_key: before.periodKey,
    direction: before.direction,
    counterparty_company_id: before.counterpartyCompanyId,
    counterparty_name: before.counterpartyName,
    counterparty_tin: before.counterpartyTin,
    income_type: before.incomeType,
    income_amount: before.incomeAmount,
    tax_rate: before.taxRate,
    tax_withheld: before.taxWithheld,
    date_received: before.dateReceived,
    remarks: before.remarks,
  };
  const changes = changedFields(beforeValues, writePayload(input), TRACKED_FIELDS);

  for (const change of changes) {
    await appendChangeLog(
      {
        companyId: before.companyId,
        taxYear: before.taxYear,
        entity: "tax_2307",
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

export async function deleteCertificate(id: number, actor: Actor): Promise<{ id: number }> {
  const existing = await getItem<Record<string, unknown>>(COLLECTION, id, FIELDS);
  if (!existing) throw new RowNotFoundError("2307 certificate", id);

  const before = mapCertificate(existing);
  await deleteItem(COLLECTION, id);
  await appendChangeLog(
    {
      companyId: before.companyId,
      taxYear: before.taxYear,
      entity: "tax_2307",
      entityRef: String(id),
      field: "DELETED",
      beforeValue: formatValues({
        period: before.periodKey,
        direction: before.direction,
        counterparty: before.counterpartyName,
        withheld: before.taxWithheld,
      }),
      afterValue: null,
      reason: null,
    },
    actor,
  );

  return { id };
}

interface SalesRow {
  invoice_date?: string | null;
  customer_code?: string | null;
  total_amount?: number | string | null;
  vat_amount?: number | string | null;
  ewt_amount?: number | string | null;
}

interface PurchaseRow {
  date?: string | null;
  supplier_name?: string | null;
  total_amount?: number | string | null;
  vat_amount?: number | string | null;
  withholding_tax_amount?: number | string | null;
}

interface CustomerRow {
  customer_code?: string | null;
  customer_name?: string | null;
  customer_tin?: string | null;
}

const PREFILL_LIMIT = 5000;

function counterpartyKey(direction: CertificateDirection, periodKey: string, name: string): string {
  return `${direction}|${periodKey}|${name.trim().toLowerCase()}`;
}

function pushAggregate(
  bag: Map<string, PrefillRow>,
  row: Omit<PrefillRow, "incomeAmount" | "taxWithheld">,
  income: number,
  withheld: number,
) {
  const key = counterpartyKey(row.direction, row.periodKey, row.counterpartyName);
  const current = bag.get(key);
  if (current) {
    current.incomeAmount = roundMoney(current.incomeAmount + income);
    current.taxWithheld = roundMoney(current.taxWithheld + withheld);
    return;
  }
  bag.set(key, { ...row, incomeAmount: roundMoney(income), taxWithheld: roundMoney(withheld) });
}

/**
 * Reads the year's sales invoices and purchase orders and drafts one certificate per
 * counterparty per quarter. Nothing is invented: income is `total_amount - vat_amount`
 * and the withheld figure is the ledger's own column. Income type defaults to "Other"
 * because the ledger does not classify it.
 */
export async function prefillCertificates(
  company: RegistryCompany,
  taxYear: number,
  actor: Actor,
): Promise<PrefillResult> {
  const notices: string[] = [];
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;
  const aggregates = new Map<string, PrefillRow>();

  let customers: CustomerRow[] = [];
  try {
    customers = await listRows<CustomerRow>(company.baseUrl, company.token, company.code, "customer", {
      fields: ["customer_code", "customer_name", "customer_tin"],
      limit: 2000,
    });
  } catch (error) {
    notices.push(`Customer names could not be read, so certificates use the customer code: ${describe(error)}`);
  }
  const customerByCode = new Map(customers.map((row) => [asString(row.customer_code), row]));

  try {
    const sales = await listRows<SalesRow>(company.baseUrl, company.token, company.code, "sales_invoice", {
      fields: ["invoice_date", "customer_code", "total_amount", "vat_amount", "ewt_amount"],
      filter: {
        _and: [
          { invoice_date: { _gte: from } },
          { invoice_date: { _lte: to } },
          { ewt_amount: { _gt: 0 } },
          { transaction_status: { _nin: CANCELLED_SALES } },
        ],
      },
      sort: "invoice_date",
      limit: PREFILL_LIMIT,
    });
    if (sales.length >= PREFILL_LIMIT) {
      notices.push(`Only the first ${PREFILL_LIMIT} sales invoices were read; later quarters may be incomplete.`);
    }

    for (const row of sales) {
      const index = quarterOf(asString(row.invoice_date));
      if (index === null) continue;
      const code = asString(row.customer_code);
      const customer = customerByCode.get(code);
      const income = asNumber(row.total_amount) - asNumber(row.vat_amount);
      const withheld = asNumber(row.ewt_amount);
      if (income <= 0 || withheld <= 0) continue;

      pushAggregate(
        aggregates,
        {
          direction: "RECEIVED",
          periodKey: QUARTER_KEYS[index],
          counterpartyName: asString(customer?.customer_name) || code || "Customer",
          counterpartyTin: asString(customer?.customer_tin) || null,
        },
        income,
        withheld,
      );
    }
  } catch (error) {
    notices.push(`Sales invoices could not be read for the prefill: ${describe(error)}`);
  }

  try {
    const purchases = await listRows<PurchaseRow>(company.baseUrl, company.token, company.code, "purchase_order", {
      fields: ["date", "supplier_name", "total_amount", "vat_amount", "withholding_tax_amount"],
      filter: {
        _and: [
          { date: { _gte: from } },
          { date: { _lte: to } },
          { withholding_tax_amount: { _gt: 0 } },
        ],
      },
      sort: "date",
      limit: PREFILL_LIMIT,
    });
    if (purchases.length >= PREFILL_LIMIT) {
      notices.push(`Only the first ${PREFILL_LIMIT} purchase orders were read; later quarters may be incomplete.`);
    }

    for (const row of purchases) {
      const index = quarterOf(asString(row.date));
      if (index === null) continue;
      const income = asNumber(row.total_amount) - asNumber(row.vat_amount);
      const withheld = asNumber(row.withholding_tax_amount);
      if (income <= 0 || withheld <= 0) continue;

      pushAggregate(
        aggregates,
        {
          direction: "ISSUED",
          periodKey: QUARTER_KEYS[index],
          counterpartyName: asString(row.supplier_name) || "Supplier",
          counterpartyTin: null,
        },
        income,
        withheld,
      );
    }
  } catch (error) {
    notices.push(`Purchase orders could not be read for the prefill: ${describe(error)}`);
  }

  if (aggregates.size === 0) {
    notices.push("No invoice in this year carries a withholding amount, so there was nothing to prefill.");
    return { created: 0, skipped: 0, notices };
  }

  let existing: Array<Omit<CertificateRow, "status">> = [];
  try {
    const { rows } = await listItems<Record<string, unknown>>(COLLECTION, {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: company.companyId } }, { tax_year: { _eq: taxYear } }] },
      limit: -1,
    });
    existing = rows.map(mapCertificate);
  } catch (error) {
    notices.push(`Existing certificates could not be read, so none were skipped: ${describe(error)}`);
  }
  const taken = new Set(existing.map((row) => counterpartyKey(row.direction, row.periodKey, row.counterpartyName)));

  let created = 0;
  let skipped = 0;

  for (const [key, draft] of aggregates) {
    if (taken.has(key)) {
      skipped += 1;
      continue;
    }

    const rate = draft.incomeAmount > 0 ? roundMoney((draft.taxWithheld / draft.incomeAmount) * 100) : 0;
    const source: CertificateSource = draft.direction === "RECEIVED" ? "SALES_INVOICE" : "PURCHASE_ORDER";

    try {
      const saved = await createItem<Record<string, unknown>>(COLLECTION, {
        company_id: company.companyId,
        tax_year: taxYear,
        period_key: draft.periodKey,
        direction: draft.direction,
        counterparty_company_id: null,
        counterparty_name: draft.counterpartyName,
        counterparty_tin: draft.counterpartyTin,
        income_type: "OTHER",
        income_amount: draft.incomeAmount,
        tax_rate: rate,
        tax_withheld: draft.taxWithheld,
        date_received: null,
        source,
        source_ref: `${taxYear} ${draft.periodKey}`,
        remarks: "Prefilled from the ledger; confirm the income type and the certificate date.",
        created_at: phtStamp(),
        created_by: actor.userId,
      });
      created += 1;
      taken.add(key);
      await appendChangeLog(
        {
          companyId: company.companyId,
          taxYear,
          entity: "tax_2307",
          entityRef: String(asNumber(saved.id)),
          field: "CREATED",
          beforeValue: null,
          afterValue: formatValues({
            direction: draft.direction,
            period: draft.periodKey,
            counterparty: draft.counterpartyName,
            withheld: draft.taxWithheld,
            source,
          }),
          reason: "Prefill from invoices",
        },
        actor,
      );
    } catch (error) {
      notices.push(`Could not draft a certificate for ${draft.counterpartyName}: ${describe(error)}`);
    }
  }

  return { created, skipped, notices };
}
