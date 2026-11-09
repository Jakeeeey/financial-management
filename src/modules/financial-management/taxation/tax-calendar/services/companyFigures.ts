import "server-only";

import type { IntercompanyMatch, QuarterFigures, RegistryCompany } from "../types";
import { listRows, sumFields, CompanyRequestError, groupedByDate } from "./companyClient";

/**
 * Where every tax figure comes from.
 *
 * One grouped request per collection per company per year (`groupBy` the date
 * column) and the quarter is bucketed here, so a nine-company overview costs about
 * forty requests instead of a thousand. VAT-inclusive amounts are the norm in this
 * ERP: `total_amount` includes VAT and `net_amount` mirrors it, so the VAT-exclusive
 * base is `total_amount - vat_amount`.
 */

const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

export interface FigureResult {
  figures: QuarterFigures[];
  matches: IntercompanyMatch[];
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

interface GroupPeer {
  company: RegistryCompany;
  customerCodes: string[];
  supplierNeedles: string[];
}

async function resolveGroupPeers(
  company: RegistryCompany,
  peers: RegistryCompany[],
): Promise<{ peers: GroupPeer[]; notices: string[] }> {
  const notices: string[] = [];
  if (peers.length === 0) return { peers: [], notices };

  const codes = peers.map((peer) => peer.code).filter(Boolean);
  const tins = peers.map((peer) => peer.tin).filter((tin): tin is string => Boolean(tin));

  let customers: Array<{ customer_code?: string | null; customer_tin?: string | null }> = [];
  try {
    customers = await listRows(company.baseUrl, company.token, company.code, "customer", {
      fields: ["customer_code", "customer_tin"],
      filter: {
        _or: [
          ...(codes.length ? [{ customer_code: { _in: codes } }] : []),
          ...(tins.length ? [{ customer_tin: { _in: tins } }] : []),
        ],
      },
      limit: 500,
    });
  } catch (error) {
    const message = error instanceof CompanyRequestError ? error.message : String(error);
    notices.push(`Intercompany sales could not be matched: ${message}`);
  }

  const resolved = peers.map<GroupPeer>((peer) => {
    const matched = customers
      .filter(
        (row) =>
          (row.customer_code && row.customer_code === peer.code) ||
          (peer.tin && row.customer_tin && row.customer_tin.replace(/\D/g, "") === peer.tin.replace(/\D/g, "")),
      )
      .map((row) => String(row.customer_code ?? ""))
      .filter(Boolean);

    return {
      company: peer,
      customerCodes: Array.from(new Set(matched)),
      supplierNeedles: [peer.name, peer.code].filter(Boolean),
    };
  });

  return { peers: resolved, notices };
}

export async function loadFigures(
  company: RegistryCompany,
  taxYear: number,
  peers: RegistryCompany[],
  options: { intercompany?: boolean } = {},
): Promise<FigureResult> {
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

  const matches: IntercompanyMatch[] = [];
  if (options.intercompany !== false) {
    const { peers: groupPeers, notices: peerNotices } = await resolveGroupPeers(company, peers);
    notices.push(...peerNotices);

    for (const peer of groupPeers) {
      let sold = 0;
      if (peer.customerCodes.length > 0) {
        try {
          const icSales = await groupedByDate(
            company.baseUrl,
            company.token,
            company.code,
            "sales_invoice",
            "invoice_date",
            { total_amount: "sum", vat_amount: "sum" },
            from,
            to,
            { customer_code: { _in: peer.customerCodes } },
          );
          bucket(figures, icSales, (quarter, sums) => {
            const base = (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
            quarter.icSales += base;
            quarter.icSalesByCompany[peer.company.code] = (quarter.icSalesByCompany[peer.company.code] ?? 0) + base;
            sold += base;
          });
        } catch {
          notices.push(`Intercompany sales to ${peer.company.code} could not be read.`);
        }
      }

      let bought = 0;
      for (const needle of peer.supplierNeedles) {
        try {
          const icPurchase = await groupedByDate(
            company.baseUrl,
            company.token,
            company.code,
            "purchase_order",
            "date",
            { total_amount: "sum", vat_amount: "sum" },
            from,
            to,
            { supplier_name: { _icontains: needle } },
          );
          bucket(figures, icPurchase, (quarter, sums) => {
            const base = (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
            quarter.icPurchases += base;
            quarter.icPurchasesByCompany[peer.company.code] =
              (quarter.icPurchasesByCompany[peer.company.code] ?? 0) + base;
            bought += base;
          });
          if (bought > 0) break;
        } catch {
          // supplier_name is free text and often absent; no match is reported as no match.
        }
      }

      if (sold > 0 || bought > 0) {
        matches.push({
          counterpartyCode: peer.company.code,
          counterpartyName: peer.company.name,
          direction: sold > 0 && bought > 0 ? "BOTH" : sold > 0 ? "SOLD_TO" : "BOUGHT_FROM",
          amount: Math.round((sold + bought) * 100) / 100,
          months: [],
          counterpartyMirrors: "UNKNOWN",
          counterpartyAmount: null,
        });
      }
    }

    if (matches.length === 0) {
      notices.push("No intercompany amount matched a group company in this year's invoices or purchase orders.");
    }
  }

  return { figures, matches, notices };
}

/** Year-level totals only — what the group overview needs, in four requests. */
export async function loadYearTotals(company: RegistryCompany, taxYear: number) {
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;
  const totals = { sales: 0, salesVat: 0, purchases: 0, purchasesVat: 0, expenses: 0, cwt: 0 };

  try {
    const sums = await sumFields(company.baseUrl, company.token, company.code, "sales_invoice", [
      "total_amount",
      "vat_amount",
      "ewt_amount",
    ], {
      _and: [
        { invoice_date: { _gte: from } },
        { invoice_date: { _lte: to } },
        { transaction_status: { _nin: CANCELLED_SALES } },
      ],
    });
    totals.sales = (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
    totals.salesVat = sums.vat_amount ?? 0;
    totals.cwt = sums.ewt_amount ?? 0;
  } catch {
    // Company unreadable or table missing: leave the zeros.
  }

  try {
    const sums = await sumFields(company.baseUrl, company.token, company.code, "purchase_order", [
      "total_amount",
      "vat_amount",
    ], { _and: [{ date: { _gte: from } }, { date: { _lte: to } }] });
    totals.purchases = (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
    totals.purchasesVat = sums.vat_amount ?? 0;
  } catch {
    // ignored
  }

  try {
    const sums = await sumFields(company.baseUrl, company.token, company.code, "expense", ["amount"], {
      _and: [{ expense_date: { _gte: from } }, { expense_date: { _lte: to } }, { is_deleted: { _eq: 0 } }],
    });
    totals.expenses = sums.amount ?? 0;
  } catch {
    // ignored
  }

  return totals;
}
