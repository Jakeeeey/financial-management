import "server-only";

import type { MonthlyWithholdingRow, PeriodKey, RegistryCompany } from "../types";
import { groupedByDate } from "./companyClient";

/**
 * Monthly withholding on outside payees, as the purchase orders record it.
 *
 * `purchase_order.withholding_tax_amount` is what the company withheld on that order.
 * That is not a remittance: the 0619-E / 1601-EQ columns only say which month's amount
 * belongs on which return, because this ERP keeps no remittance ledger.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const QUARTERS: PeriodKey[] = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2", "Q3", "Q3", "Q3", "Q4", "Q4", "Q4"];

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function emptyMonthly(): MonthlyWithholdingRow[] {
  return MONTHS.map((label, index) => buildRow(index + 1, label, 0, 0));
}

function buildRow(month: number, label: string, purchases: number, withheld: number): MonthlyWithholdingRow {
  const quarterEnd = month % 3 === 0;
  return {
    month,
    label,
    quarter: QUARTERS[month - 1],
    quarterEnd,
    // The form that carries this month's withheld amount.
    purchases: round(purchases),
    withheld: round(withheld),
    agentForm: quarterEnd ? null : "0619-E",
    quarterlyForm: quarterEnd ? "1601-EQ" : null,
    agentDue: quarterEnd ? null : round(withheld),
    quarterlyDue: null,
  };
}

export async function loadMonthlyWithholding(
  company: RegistryCompany,
  taxYear: number,
): Promise<{ monthly: MonthlyWithholdingRow[]; notices: string[] }> {
  const notices: string[] = [];
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;

  let rows: Array<{ date: string; sums: Record<string, number> }> = [];
  try {
    rows = await groupedByDate(
      company.baseUrl,
      company.token,
      company.code,
      "purchase_order",
      "date",
      { total_amount: "sum", vat_amount: "sum", withholding_tax_amount: "sum" },
      from,
      to,
    );
  } catch (error) {
    notices.push(
      `Withholding per month could not be read from purchase orders: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { monthly: emptyMonthly(), notices };
  }

  const purchases = new Array<number>(12).fill(0);
  const withheld = new Array<number>(12).fill(0);
  for (const row of rows) {
    const month = Number(row.date.slice(5, 7));
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    // VAT-exclusive base: withholding is computed on the net of VAT.
    purchases[month - 1] += (row.sums.total_amount ?? 0) - (row.sums.vat_amount ?? 0);
    withheld[month - 1] += row.sums.withholding_tax_amount ?? 0;
  }

  const monthly = MONTHS.map((label, index) => buildRow(index + 1, label, purchases[index], withheld[index]));
  const quarterTotals = [0, 1, 2, 3].map((quarter) =>
    round(withheld.slice(quarter * 3, quarter * 3 + 3).reduce((sum, value) => sum + value, 0)),
  );
  for (const row of monthly) {
    if (!row.quarterEnd) continue;
    row.quarterlyDue = quarterTotals[Math.floor((row.month - 1) / 3)];
  }

  return { monthly, notices };
}
