import "server-only";

import type { QuarterFigures, RegistryCompany } from "../types";
import { CompanyRequestError, groupedByDate } from "./companyClient";

/**
 * Where the VAT figures come from.
 *
 * One grouped request per collection per company per year (`groupBy` the date column)
 * and the quarter is bucketed here. VAT-inclusive amounts are the norm in this ERP:
 * `total_amount` includes VAT, so the VAT-exclusive base is `total_amount - vat_amount`.
 * `sales_invoice.ewt_amount` is what customers withheld, i.e. the 2307 you should hold.
 */

const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

export interface VatFigureResult {
  figures: QuarterFigures[];
  notices: string[];
  /** Names of the sources that could not be read, in the order they were attempted. */
  failed: string[];
}

/**
 * Turns a transport failure into a sentence an accountant can act on.
 * The raw strings ("fetch failed", "The operation was aborted due to timeout") are
 * implementation noise and never belong in a panel.
 */
function readFailure(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    if (error.status === 0) {
      const raw = error.message.toLowerCase();
      if (raw.includes("timeout") || raw.includes("aborted")) return "did not answer within 20 seconds";
      return "could not be reached";
    }
    if (error.status === 401 || error.status === 403) return `refused the instance token (${error.status})`;
    if (error.status === 404) return "has no such collection (404)";
    return `answered with an error (${error.status})`;
  }
  return "could not be read";
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

export function emptyFigures(): QuarterFigures[] {
  return [0, 1, 2, 3].map(emptyQuarter);
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

export async function loadVatFigures(company: RegistryCompany, taxYear: number): Promise<VatFigureResult> {
  const notices: string[] = [];
  const failed: string[] = [];
  const figures = emptyFigures();
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
    failed.push("sales");
    notices.push(`Sales invoices ${readFailure(error)}, so sales and output VAT are not shown rather than shown as zero.`);
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
    failed.push("purchases");
    notices.push(`Purchase orders ${readFailure(error)}, so input VAT covers sales-side figures only.`);
  }

  return { figures, notices, failed };
}
