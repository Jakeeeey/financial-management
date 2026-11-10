import "server-only";

import type { ExpenseBreakdown, IntercompanyMatch, QuarterFigures, RegistryCompany } from "../types";
import { VAT_RATE } from "../constants";
import { listRows, sumFields, CompanyRequestError, groupedByDate } from "./companyClient";
import { loadSttSales, loadSpringExpenses, loadSpringSales } from "./stt.client";

/**
 * Where every tax figure comes from.
 *
 * One grouped request per collection per company per year (`groupBy` the date
 * column) and the quarter is bucketed here, so a nine-company overview costs about
 * forty requests instead of a thousand. VAT-inclusive amounts are the norm in this
 * ERP: `total_amount` includes VAT and `net_amount` mirrors it, so the VAT-exclusive
 * base is `total_amount - vat_amount`.
 *
 * Sales are read from the itemized Spring view when the company has one, because that
 * is the view the STT sales report sums; the invoice register is the fallback.
 */

const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

/**
 * `chart_of_accounts.account_type` values a return may deduct: 7 cost of goods sold,
 * 8 cost of services, 9 operating expenses, 10 finance costs. Everything else the
 * disbursement ledger carries (inventory, receivables, loans, taxes payable, equity)
 * is a balance-sheet movement, not a deduction.
 */
const DEDUCTIBLE_TYPES = new Set(["7", "8", "9", "10"]);

async function loadDeductibleAccounts(company: RegistryCompany): Promise<number[] | null> {
  try {
    const rows = await listRows<{ coa_id?: number | string; account_type?: string | number | null }>(
      company.baseUrl,
      company.token,
      company.code,
      "chart_of_accounts",
      { fields: ["coa_id", "account_type"], limit: -1 },
    );
    const ids = rows
      .filter((row) => DEDUCTIBLE_TYPES.has(String(row.account_type ?? "").trim()))
      .map((row) => Number(row.coa_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  "1": "Assets",
  "2": "Property, plant and equipment",
  "3": "Liabilities",
  "4": "Long-term liabilities",
  "5": "Equity",
  "6": "Income",
  "7": "Cost of goods sold",
  "8": "Cost of services",
  "9": "Operating expenses",
  "10": "Finance costs",
};

interface AccountDirectory {
  typeById: Map<number, string>;
  titleById: Map<number, string>;
}

async function loadAccountDirectory(company: RegistryCompany): Promise<AccountDirectory | null> {
  try {
    const rows = await listRows<{
      coa_id?: number | string;
      account_type?: string | number | null;
      account_title?: string | null;
    }>(company.baseUrl, company.token, company.code, "chart_of_accounts", {
      fields: ["coa_id", "account_type", "account_title"],
      limit: -1,
    });
    const typeById = new Map<number, string>();
    const titleById = new Map<number, string>();
    for (const row of rows) {
      const id = Number(row.coa_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      typeById.set(id, String(row.account_type ?? "").trim());
      titleById.set(id, String(row.account_title ?? "").trim());
    }
    return typeById.size > 0 ? { typeById, titleById } : null;
  } catch {
    return null;
  }
}

/**
 * Where the deduction line comes from, account type by account type.
 *
 * The disbursement ledger carries everything that left the bank: stock, loan repayments, tax
 * payments, asset purchases. Only the income-statement types are deductions, so the panel has
 * to show both halves — what was disbursed and which part of it the return may subtract.
 */
export async function loadExpenseBreakdown(
  company: RegistryCompany,
  taxYear: number,
  options: { springToken?: string | null } = {},
): Promise<ExpenseBreakdown | null> {
  if (!company.springUrl || !options.springToken) return null;
  const directory = await loadAccountDirectory(company);
  if (!directory) return null;

  const spring = await loadSpringExpenses(company, options.springToken, taxYear);
  if (!spring.lines || spring.lines.length === 0) return null;

  const byType = new Map<string, number>();
  const byAccount = new Map<number, number>();
  let total = 0;
  for (const line of spring.lines) {
    const type = directory.typeById.get(line.coaId) ?? "";
    byType.set(type, (byType.get(type) ?? 0) + line.amount);
    total += line.amount;
    if (DEDUCTIBLE_TYPES.has(type)) byAccount.set(line.coaId, (byAccount.get(line.coaId) ?? 0) + line.amount);
  }

  const rows = [...byType.entries()]
    .map(([type, amount]) => ({
      type,
      label: ACCOUNT_TYPE_LABELS[type] ?? (type ? `Other (type ${type})` : "Not classified in the chart of accounts"),
      amount: Math.round(amount * 100) / 100,
      deductible: DEDUCTIBLE_TYPES.has(type),
    }))
    .sort((left, right) => right.amount - left.amount);

  const accounts = [...byAccount.entries()]
    .map(([coaId, amount]) => ({
      title: directory.titleById.get(coaId) || `Account ${coaId}`,
      type: directory.typeById.get(coaId) ?? "",
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 8);

  const deductible = rows.filter((row) => row.deductible).reduce((sum, row) => sum + row.amount, 0);
  return { total: Math.round(total * 100) / 100, deductible: Math.round(deductible * 100) / 100, rows, accounts, source: "SPRING" };
}

export interface FigureResult {
  figures: QuarterFigures[];
  matches: IntercompanyMatch[];
  notices: string[];
  /** Sources that could not be read at all, e.g. "sales". The figures are then unknown, not zero. */
  failed: string[];
  salesSource: "STT_VIEW" | "INVOICE_LINES" | "INVOICE_HEADERS";
}

function emptyQuarter(): QuarterFigures {
  return {
    sales: 0,
    salesVat: 0,
    discounts: 0,
    returns: 0,
    returnsVat: 0,
    purchases: 0,
    purchasesVat: 0,
    cogsProductCost: 0,
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

/** Same quarter rule, exported for per-line sums that never become grouped rows. */
export function quarterIndex(dateValue: string): number {
  return quarterOf(dateValue);
}

/**
 * Payable lines carry their own `date`, which is null on some rows − filtering on it silently
 * drops money. The voucher's `transaction_date` is always present, so a line is attributed to
 * the quarter its disbursement was booked in, and the sum matches the disbursement header.
 */
async function payableRowsByDisbursementDate(
  company: RegistryCompany,
  from: string,
  to: string,
  coaIds: number[],
): Promise<Array<{ date: string; sums: Record<string, number> }>> {
  const vouchers = await listRows<{ id: number; transaction_date: string | null }>(
    company.baseUrl,
    company.token,
    company.code,
    "disbursement",
    {
      fields: ["id", "transaction_date"],
      filter: { _and: [{ transaction_date: { _gte: from } }, { transaction_date: { _lte: to } }] },
      limit: -1,
    },
  );
  const dateOf = new Map<number, string>();
  for (const voucher of vouchers) {
    if (voucher.transaction_date) dateOf.set(Number(voucher.id), String(voucher.transaction_date).slice(0, 10));
  }
  if (dateOf.size === 0) return [];

  const lines = await listRows<{ disbursement_id: number; amount: number | string | null; coa_id: number | null }>(
    company.baseUrl,
    company.token,
    company.code,
    "disbursement_payables",
    {
      fields: ["disbursement_id", "amount", "coa_id"],
      filter: { _and: [{ disbursement_id: { _in: [...dateOf.keys()] } }, { coa_id: { _in: coaIds } }] },
      limit: -1,
    },
  );

  const byDate = new Map<string, number>();
  for (const line of lines) {
    const date = dateOf.get(Number(line.disbursement_id));
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + (Number(line.amount) || 0));
  }

  return [...byDate.entries()].map(([date, amount]) => ({ date, sums: { amount } }));
}

function bucket(  figures: QuarterFigures[],
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
  options: { intercompany?: boolean; vatRate?: number; springToken?: string | null } = {},
): Promise<FigureResult> {
  const notices: string[] = [];
  const failed: string[] = [];
  const figures = [0, 1, 2, 3].map(emptyQuarter);
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;
  const vatRate = options.vatRate ?? VAT_RATE;
  let salesSource: FigureResult["salesSource"] = "INVOICE_HEADERS";

  try {
    const sales = await groupedByDate(company.baseUrl, company.token, company.code, "sales_invoice", "invoice_date", {
      total_amount: "sum",
      vat_amount: "sum",
      discount_amount: "sum",
    }, from, to, { transaction_status: { _nin: CANCELLED_SALES } });

    bucket(figures, sales, (quarter, sums) => {
      quarter.sales += (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
      quarter.salesVat += sums.vat_amount ?? 0;
      quarter.discounts += sums.discount_amount ?? 0;
    });

    // Same view the sales report sums, one quarter at a time. The by-channel summary is cheaper but
    // left ₱21.7M of 2026 revenue out, so it is only reached when the itemized view fails.
    const springSales = options.springToken
      ? await loadSpringSales(company, options.springToken, taxYear)
      : { sales: null, reason: "no Spring session token was forwarded" as string | null };
    const stt = springSales.sales ? springSales : await loadSttSales(company, taxYear);
    if (stt.sales) {
      const gross = stt.sales.quarters;
      const net = gross.map((value) => value / (1 + vatRate));
      figures.forEach((quarter, index) => {
        if (gross[index] > 0) {
          quarter.sales = net[index];
          quarter.salesVat = gross[index] - net[index];
        }
      });
      const yearGross = gross.reduce((total, value) => total + value, 0);
      const yearRegister = figures.reduce((total, quarter) => total + quarter.sales + quarter.salesVat, 0);
      salesSource = "STT_VIEW";
      notices.push(
        `Sales come from the itemized sales view: ${stt.sales.lines} product lines on ${stt.sales.invoices} invoices. ` +
          `The invoice register carries ${yearRegister.toFixed(2)} for the same year, so the two bases differ by ${(yearRegister - yearGross).toFixed(2)}.`,
      );
      if (stt.reason) notices.push(`Only part of the year came from that view: ${stt.reason}.`);
    } else if (stt.reason) {
      notices.push(`Sales fall back to the invoice register because ${stt.reason}.`);
    }

    // `ewt_amount` does not exist on every instance (Vertex has no such column, and Directus fails
    // the whole grouped query when one summed field is unknown). Its own request keeps the sales
    // figures instead of losing them to an optional column.
    try {
      const withheld = await groupedByDate(
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
      bucket(figures, withheld, (quarter, sums) => {
        quarter.cwt += sums.ewt_amount ?? 0;
      });
    } catch {
      notices.push("This instance has no tax-withheld column on its sales invoices, so credits are zero.");
    }
  } catch (error) {
    failed.push("sales");
    notices.push(`Sales invoices could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Cost of sales has no ledger in this ERP. The two readings the desk shows are the
  // product standard cost (quantity × `products.cost_per_unit`) and purchase orders.
  try {
    const lines = await groupedByDate(
      company.baseUrl,
      company.token,
      company.code,
      "sales_invoice_details",
      "created_date",
      { total_amount: "sum" },
      from,
      to,
    );
    const lineTotal = lines.reduce((total, row) => total + (row.sums.total_amount ?? 0), 0);
    if (lineTotal > 0) {
      const byProduct = await groupedByDate(
        company.baseUrl,
        company.token,
        company.code,
        "sales_invoice_details",
        "product_id",
        { quantity: "sum" },
        from,
        to,
      );
      const products = await listRows<{ product_id?: number | string | null; cost_per_unit?: number | string | null }>(
        company.baseUrl,
        company.token,
        company.code,
        "products",
        { fields: ["product_id", "cost_per_unit"], limit: -1 },
      );
      const costById = new Map(products.map((row) => [String(row.product_id ?? ""), Number(row.cost_per_unit ?? 0) || 0]));
      let cost = 0;
      let costedLines = 0;
      for (const row of byProduct) {
        const unitCost = costById.get(String(row.date));
        if (!unitCost) continue;
        cost += (row.sums.quantity ?? 0) * unitCost;
        costedLines += 1;
      }
      if (cost > 0) {
        const ratio = cost / lineTotal;
        bucket(figures, lines, (quarter, sums) => {
          quarter.cogsProductCost += (sums.total_amount ?? 0) * ratio;
        });
        notices.push(
          `Product standard cost covers ${costedLines} of ${byProduct.length} sold products; line amounts carry the rest at cost ${(ratio * 100).toFixed(1)}% of price.`,
        );
      } else {
        notices.push("No product carries a standard cost, so cost of sales from product cost is zero.");
      }
      if (salesSource !== "STT_VIEW") salesSource = "INVOICE_LINES";
    }
  } catch {
    notices.push("The sales detail lines could not be read, so product standard cost is zero.");
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
    failed.push("purchases");
    notices.push(`Purchase orders could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Deductions, not disbursements. Men2's 2026 disbursement ledger holds ₱24.6M across 58
   * accounts, but ₱21.1M of it is "Dummy Inventories", ₱2.2M input VAT and ₱1.5M loan and
   * payable settlements − none of which a return deducts. Only lines posted to cost of sales,
   * cost of services, operating expense or finance-cost accounts are counted.
   */
  const deductibleAccounts = await loadDeductibleAccounts(company);
  let expenseBooked = false;

  if (deductibleAccounts && company.springUrl && options.springToken) {
    const spring = await loadSpringExpenses(company, options.springToken, taxYear);
    if (spring.lines && spring.lines.length > 0) {
      const allowed = new Set(deductibleAccounts);
      for (const line of spring.lines) {
        if (!allowed.has(line.coaId)) continue;
        const quarter = quarterIndex(line.date);
        if (quarter >= 0) figures[quarter].expenses += line.amount;
      }
      expenseBooked = true;
      notices.push(
        `Deductions come from the itemized disbursement view, counting only the ${deductibleAccounts.length} ` +
          "cost of sales, cost of services, operating expense and finance-cost accounts. Settlements of inventory, " +
          "receivables, loans and taxes are balance-sheet movements and are excluded.",
      );
    } else if (spring.reason) {
      notices.push(`The itemized disbursement view was not used because ${spring.reason}.`);
    }
  }

  if (deductibleAccounts) {
    try {
      const payables = await payableRowsByDisbursementDate(company, from, to, deductibleAccounts);
      if (payables.length > 0) {
        bucket(figures, payables, (quarter, sums) => {
          quarter.expenses += sums.amount ?? 0;
        });
        expenseBooked = true;
        notices.push(
          `Deductions count only the ${deductibleAccounts.length} expense, cost of sales and finance-cost accounts. ` +
            "Payments that settled inventory, receivables, loans or taxes are balance-sheet movements and are excluded.",
        );
      }
    } catch (error) {
      notices.push(
        `Disbursement lines could not be read (${
          error instanceof Error ? error.message : String(error)
        }), so deductions fall back to the expense register.`,
      );
    }
  }

  if (!expenseBooked) {
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

  return { figures, matches, notices, failed, salesSource };
}

/** Year-level totals only − what the group overview needs, in a handful of requests. */
export async function loadYearTotals(company: RegistryCompany, taxYear: number, vatRate: number = VAT_RATE) {
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;
  const totals = {
    sales: 0,
    salesVat: 0,
    discounts: 0,
    purchases: 0,
    purchasesVat: 0,
    cogsProductCost: 0,
    expenses: 0,
    cwt: 0,
    salesSource: "INVOICE_HEADERS" as FigureResult["salesSource"],
  };

  try {
    const sums = await sumFields(company.baseUrl, company.token, company.code, "sales_invoice", [
      "total_amount",
      "vat_amount",
      "discount_amount",
    ], {
      _and: [
        { invoice_date: { _gte: from } },
        { invoice_date: { _lte: to } },
        { transaction_status: { _nin: CANCELLED_SALES } },
      ],
    });
    totals.sales = (sums.total_amount ?? 0) - (sums.vat_amount ?? 0);
    totals.salesVat = sums.vat_amount ?? 0;
    totals.discounts = sums.discount_amount ?? 0;
  } catch {
    // Company unreadable or table missing: leave the zeros.
  }

  try {
    const sums = await sumFields(company.baseUrl, company.token, company.code, "sales_invoice", ["ewt_amount"], {
      _and: [
        { invoice_date: { _gte: from } },
        { invoice_date: { _lte: to } },
        { transaction_status: { _nin: CANCELLED_SALES } },
      ],
    });
    totals.cwt = sums.ewt_amount ?? 0;
  } catch {
    // Vertex has no ewt_amount column; credits stay zero rather than breaking the row.
  }

  const stt = await loadSttSales(company, taxYear);
  if (stt.sales) {
    const gross = stt.sales.quarters.reduce((total, value) => total + value, 0);
    totals.sales = gross / (1 + vatRate);
    totals.salesVat = gross - totals.sales;
    totals.salesSource = "STT_VIEW";
  }

  if (stt.sales === null && stt.reason) totals.salesSource = "INVOICE_HEADERS";

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
    const lines = await sumFields(
      company.baseUrl,
      company.token,
      company.code,
      "sales_invoice_details",
      ["total_amount"],
      { _and: [{ created_date: { _gte: from } }, { created_date: { _lte: to } }] },
    );
    const lineTotal = lines.total_amount ?? 0;
    if (lineTotal > 0) {
      const byProduct = await groupedByDate(
        company.baseUrl,
        company.token,
        company.code,
        "sales_invoice_details",
        "product_id",
        { quantity: "sum" },
        from,
        to,
      );
      const products = await listRows<{ product_id?: number | string | null; cost_per_unit?: number | string | null }>(
        company.baseUrl,
        company.token,
        company.code,
        "products",
        { fields: ["product_id", "cost_per_unit"], limit: -1 },
      );
      const costById = new Map(products.map((row) => [String(row.product_id ?? ""), Number(row.cost_per_unit ?? 0) || 0]));
      let cost = 0;
      for (const row of byProduct) {
        const unitCost = costById.get(String(row.date));
        if (!unitCost) continue;
        cost += (row.sums.quantity ?? 0) * unitCost;
      }
      totals.cogsProductCost = cost;
    }
  } catch {
    // Alternative basis stays zero; the entity worksheet reports why.
  }

  const deductibleAccounts = await loadDeductibleAccounts(company);
  if (deductibleAccounts) {
    try {
      const rows = await payableRowsByDisbursementDate(company, from, to, deductibleAccounts);
      totals.expenses = rows.reduce((total, row) => total + (row.sums.amount ?? 0), 0);
    } catch {
      // Falls back to the expense register below.
    }
  }

  if (totals.expenses === 0) {
    try {
      const sums = await sumFields(company.baseUrl, company.token, company.code, "expense", ["amount"], {
        _and: [{ expense_date: { _gte: from } }, { expense_date: { _lte: to } }, { is_deleted: { _eq: 0 } }],
      });
      totals.expenses = sums.amount ?? 0;
    } catch {
      // ignored
    }
  }

  return totals;
}




