import "server-only";

import type { QuarterFigures, RegistryCompany } from "../types";
import { groupedByDate } from "./companyClient";

/**
 * Where every tax figure comes from.
 *
 * One grouped request per collection per company per year (`groupBy` the date
 * column) and the quarter is bucketed here, so a nine-company overview costs about
 * forty requests instead of a thousand. VAT-inclusive amounts are the norm in this
 * ERP: `total_amount` includes VAT, so the VAT-exclusive base is
 * `total_amount - vat_amount`.
 *
 * The group overview never reads intercompany lines (`intercompany: false`), so this
 * copy of the kernel carries only the four outside-party reads.
 */

const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

export interface FigureResult {
  figures: QuarterFigures[];
  notices: string[];
}

function emptyQuarter(): QuarterFigures {
  return {
    sales: 0,
    salesVat: 0,
    returns: 0,
    returnsVat: 0,
    purchases: 0,
    purchasesVat: 0,
    expenses: 0,
    cwt: 0,
    icSales: 0,
    icPurchases: 0,
    icSalesByCompany: {},
    icPurchasesByCompany: {},
  };
}

function quarterOf(dateValue: string): number {
  const month = Number(dateValue.slice(5, 7));
  if (!month) return -1;
  return Math.min(3, Math.floor((month - 1) / 3));
}

function bucket(
  figures: QuarterFigures[],
  rows: Array<{ date: string; sums: Record<string, number> }>,
  apply: (quarter: QuarterFigures, sums: Record<string, number>) => void,
) {
  for (const row of rows) {
    const index = quarterOf(row.date);
    if (index < 0) continue;
    apply(figures[index], row.sums);
  }
}

export async function loadFigures(company: RegistryCompany, taxYear: number): Promise<FigureResult> {
  const notices: string[] = [];
  const figures = [0, 1, 2, 3].map(emptyQuarter);
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;

  try {
    const sales = await groupedByDate(company.baseUrl, company.token, company.code, "sales_invoice", "invoice_date", {
      total_amount: "sum",
      vat_amount: "sum",
      ewt_amount: "sum",
    }, from, to, { transaction_status: { _nin: CANCELLED_SALES } });
    bucket(figures, sales, (quarter, sums) => {
      quarter.sales += (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
      quarter.salesVat += sums.vat_amount ?? 0;
      quarter.cwt += sums.ewt_amount ?? 0;
    });
  } catch (error) {
    notices.push(`Sales: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const returns = await groupedByDate(company.baseUrl, company.token, company.code, "sales_return", "return_date", {
      total_amount: "sum",
    }, from, to);
    bucket(figures, returns, (quarter, sums) => {
      quarter.returns += sums.total_amount ?? 0;
    });
  } catch {
    // No returns table on this instance; zero is the honest answer.
  }

  try {
    const purchases = await groupedByDate(company.baseUrl, company.token, company.code, "purchase_order", "date", {
      total_amount: "sum",
      vat_amount: "sum",
    }, from, to);
    bucket(figures, purchases, (quarter, sums) => {
      quarter.purchases += (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
      quarter.purchasesVat += sums.vat_amount ?? 0;
    });
  } catch (error) {
    notices.push(`Purchases: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const expenses = await groupedByDate(company.baseUrl, company.token, company.code, "expense", "expense_date", {
      amount: "sum",
    }, from, to, { is_deleted: { _eq: 0 } });
    bucket(figures, expenses, (quarter, sums) => {
      quarter.expenses += sums.amount ?? 0;
    });
  } catch {
    try {
      const legacy = await groupedByDate(company.baseUrl, company.token, company.code, "expenses", "transaction_date", {
        total_expense: "sum",
      }, from, to);
      bucket(figures, legacy, (quarter, sums) => {
        quarter.expenses += sums.total_expense ?? 0;
      });
    } catch {
      notices.push("No expense ledger on this instance, so operating expenses are zero.");
    }
  }

  return { figures, notices };
}
