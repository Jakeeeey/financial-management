import "server-only";

import type { RegistryCompany } from "../types";

/**
 * Sales totals from the same itemized Spring view the STT sales report reads
 * (`view-sales-report-itemized`), so the tax desk and the sales report cannot disagree
 * about what a year's sales were.
 *
 * It is one row per product line. The report's own KPI sums `productTotalAmount`, takes
 * the header `discountAmount` once per invoice, and counts returns separately − this does
 * the same, bucketed into quarters.
 *
 * Two things this endpoint does that must be handled, not swallowed: it rate-limits with
 * HTTP 429 and an empty body, and it times out quietly on a cold start. Both return null
 * so the caller can fall back to the invoice register and say so.
 */

interface SttRow {
  invoiceId?: number | string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  totalAmount?: number | string | null;
  discountAmount?: number | string | null;
  returnTotalAmount?: number | string | null;
  productTotalAmount?: number | string | null;
}

export interface ExpenseLine {
  coaId: number;
  coaTitle: string;
  date: string;
  amount: number;
}

/**
 * The same disbursement ledger BIA's expense report reads, as one itemized row per payable
 * line. It is one request and already carries the account, the payee and the VAT type, so the
 * desk does not have to join three collections to learn where the money went.
 *
 * Authentication is the signed-in user's Spring token: `/auth/login` returns it and the app
 * already keeps it in the `vos_access_token` cookie, so no service credential is added here.
 */
export async function loadSpringExpenses(
  company: RegistryCompany,
  springToken: string,
  taxYear: number,
): Promise<{ lines: ExpenseLine[] | null; reason: string | null }> {
  const base = company.springUrl?.replace(/\/+$/, "");
  if (!base) return { lines: null, reason: `${company.code} has no Spring endpoint in the registry` };

  const params = new URLSearchParams({ startDate: `${taxYear}-01-01`, endDate: `${taxYear}-12-31` });
  let response: Response;
  try {
    response = await fetch(`${base}/api/view-disbursement-itemized/all?${params.toString()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${springToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { lines: null, reason: "the disbursement view refused the connection" };
  }

  if (!response.ok) {
    return {
      lines: null,
      reason:
        response.status === 401 || response.status === 403
          ? `the disbursement view refused the session token (${response.status})`
          : `the disbursement view answered with an error (${response.status})`,
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const rows = Array.isArray(payload)
    ? (payload as SpringDisbursementRow[])
    : ((payload as { data?: SpringDisbursementRow[] } | null)?.data ?? []);
  if (rows.length === 0) return { lines: [], reason: null };

  const lines = rows
    .map((row) => ({
      coaId: Number(row.coaId ?? 0),
      coaTitle: String(row.coaTitle ?? "").trim(),
      date: String(row.lineDate ?? row.transactionDate ?? "").slice(0, 10),
      amount: Number(row.lineAmount ?? 0) || 0,
    }))
    .filter((line) => line.date.length === 10 && Number.isFinite(line.amount));

  return { lines, reason: null };
}

interface SpringDisbursementRow {
  coaId?: number | string | null;
  coaTitle?: string | null;
  lineDate?: string | null;
  transactionDate?: string | null;
  lineAmount?: number | string | null;
}

export interface SttSales {
  /** VAT-inclusive product revenue per quarter. */
  quarters: number[];
  /** Header total per quarter, for reconciling against the register. */
  headerQuarters: number[];
  discounts: number;
  returns: number;
  invoices: number;
  lines: number;
}

/**
 * The exact request the sales report makes: one call for the whole year against
 * `view-sales-report-itemized`, summing `productTotalAmount`. Quarterly windows used to split it,
 * which risked partial years on a throttle; the report itself asks once, so the desk does too.
 */
export async function loadSpringSalesItemized(
  company: RegistryCompany,
  springToken: string,
  taxYear: number,
): Promise<{ sales: SttSales | null; reason: string | null }> {
  const base = company.springUrl?.replace(/\/+$/, "");
  if (!base) return { sales: null, reason: `${company.code} has no Spring endpoint in the registry` };

  const query = new URLSearchParams({ startDate: `${taxYear}-01-01`, endDate: `${taxYear}-12-31` });
  const url = `${base}/api/view-sales-report-itemized/filtered?${query.toString()}`;

  let response = await fetchSales(url, springToken);
  // The view throttles bursts with 429; one short pause is enough in practice.
  if (response && response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    response = await fetchSales(url, springToken);
  }
  if (!response) return { sales: null, reason: "the itemized sales view refused the connection" };
  if (!response.ok) {
    return {
      sales: null,
      reason:
        response.status === 429
          ? "the itemized sales view is rate-limited right now (429)"
          : response.status === 401 || response.status === 403
            ? `the itemized sales view refused the session token (${response.status})`
            : `the itemized sales view answered with an error (${response.status})`,
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const rows = Array.isArray(payload)
    ? (payload as SpringSalesRow[])
    : ((payload as { data?: SpringSalesRow[] } | null)?.data ?? []);
  if (rows.length === 0) return { sales: null, reason: "the itemized sales view returned no rows for this year" };

  const quarters = [0, 0, 0, 0];
  const headerQuarters = [0, 0, 0, 0];
  const invoices = new Set<string>();
  const headerSeen = new Set<string>();
  let discounts = 0;

  for (const row of rows) {
    const date = String(row.invoiceDate ?? row.transactionDate ?? "").slice(0, 10);
    const index = quarterOf(date);
    if (index < 0) continue;
    quarters[index] += number(row.productTotalAmount);
    discounts += number(row.productDiscountAmount);
    const key = String(row.invoiceNo ?? "");
    if (key) invoices.add(key);
    // The header total belongs to the invoice, not to each product line on it.
    if (key && !headerSeen.has(key)) {
      headerSeen.add(key);
      headerQuarters[index] += number(row.totalAmount);
    }
  }

  return {
    sales: {
      quarters: quarters.map((value) => Math.round(value * 100) / 100),
      headerQuarters: headerQuarters.map((value) => Math.round(value * 100) / 100),
      discounts: Math.round(discounts * 100) / 100,
      returns: 0,
      invoices: invoices.size,
      lines: rows.length,
    },
    reason: null,
  };
}

async function fetchSales(url: string, springToken: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${springToken}` },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return null;
  }
}

interface SpringSalesRow {
  invoiceDate?: string | null;
  transactionDate?: string | null;
  netAmount?: number | string | null;
  customerCode?: string | null;
  invoiceNo?: string | null;
  totalAmount?: number | string | null;
  productTotalAmount?: number | string | null;
  productDiscountAmount?: number | string | null;
}

const number = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function quarterOf(dateValue: string): number {
  const month = Number(dateValue.slice(5, 7));
  if (!month) return -1;
  return Math.min(3, Math.floor((month - 1) / 3));
}

export async function loadSttSales(
  company: RegistryCompany,
  taxYear: number,
): Promise<{ sales: SttSales | null; reason: string | null }> {
  if (!company.springUrl) return { sales: null, reason: "the registry has no Spring endpoint for this company" };

  const base = company.springUrl.replace(/\/+$/, "");
  const query = new URLSearchParams({ startDate: `${taxYear}-01-01`, endDate: `${taxYear}-12-31` });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (company.springToken) headers.Authorization = `Bearer ${company.springToken}`;

  let response: Response;
  try {
    response = await fetch(`${base}/api/view-sales-report-itemized/filtered?${query.toString()}`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message.toLowerCase() : "";
    return {
      sales: null,
      reason: raw.includes("timeout") || raw.includes("abort") ? "the itemized view timed out" : "the itemized view refused the connection",
    };
  }

  if (response.status === 429) return { sales: null, reason: "the itemized view rate-limited the request (429)" };
  if (!response.ok) return { sales: null, reason: `the itemized view answered ${response.status}` };

  const payload = (await response.json().catch(() => null)) as SttRow[] | { data?: SttRow[] } | null;
  const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
  if (rows.length === 0) return { sales: null, reason: "the itemized view returned no rows for this year" };

  const quarters = [0, 0, 0, 0];
  const headerQuarters = [0, 0, 0, 0];
  const seenInvoices = new Set<string>();
  let discounts = 0;
  let returns = 0;

  for (const row of rows) {
    const index = quarterOf(String(row.invoiceDate ?? ""));
    if (index < 0) continue;

    const product = number(row.productTotalAmount);
    const header = number(row.totalAmount);
    quarters[index] += product;
    headerQuarters[index] += header;
    returns += number(row.returnTotalAmount);

    const invoiceKey = String(row.invoiceId ?? row.invoiceNo ?? "");
    if (invoiceKey && !seenInvoices.has(invoiceKey)) {
      seenInvoices.add(invoiceKey);
      discounts += number(row.discountAmount);
    }
  }

  if (quarters.every((value) => value === 0)) {
    return { sales: null, reason: "the itemized view has no product amounts for this year" };
  }

  return {
    sales: { quarters, headerQuarters, discounts, returns, invoices: seenInvoices.size, lines: rows.length },
    reason: null,
  };
}

const channelCache = new Map<string, { at: number; sales: SttSales | null }>();
const CHANNEL_TTL_MS = 10 * 60_000;

/** Refresh must actually re-read the views, so the per-company sales cache is cleared with it. */
export function clearSalesCache(): void {
  channelCache.clear();
}

async function loadSpringSalesByChannel(
  company: RegistryCompany,
  springToken: string,
  taxYear: number,
): Promise<{ sales: SttSales | null; reason: string | null }> {
  const cacheKey = `${company.companyId}:${taxYear}`;
  const cached = channelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) return { sales: cached.sales, reason: null };

  const base = company.springUrl?.replace(/\/+$/, "");
  if (!base) return { sales: null, reason: `${company.code} has no Spring endpoint in the registry` };

  const query = new URLSearchParams({ startDate: `${taxYear}-01-01`, endDate: `${taxYear}-12-31` });
  const response = await fetchSales(`${base}/api/view-sales-performance-by-channel/all?${query.toString()}`, springToken);
  if (!response) return { sales: null, reason: "the sales performance view refused the connection" };
  if (!response.ok) {
    return { sales: null, reason: `the sales performance view answered with an error (${response.status})` };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const rows = Array.isArray(payload)
    ? (payload as SpringSalesRow[])
    : ((payload as { data?: SpringSalesRow[] } | null)?.data ?? []);
  if (rows.length === 0) return { sales: null, reason: "the sales performance view returned no rows for this year" };

  const quarters = [0, 0, 0, 0];
  const customers = new Set<string>();
  for (const row of rows) {
    const index = quarterOf(String(row.transactionDate ?? "").slice(0, 10));
    if (index < 0) continue;
    quarters[index] += number(row.netAmount);
    if (row.customerCode) customers.add(String(row.customerCode));
  }

  const sales: SttSales = {
    quarters: quarters.map((value) => Math.round(value * 100) / 100),
    headerQuarters: quarters.map((value) => Math.round(value * 100) / 100),
    discounts: 0,
    returns: 0,
    invoices: customers.size,
    lines: rows.length,
  };
  channelCache.set(cacheKey, { at: Date.now(), sales });
  return { sales, reason: null };
}

/**
 * Group overview reads every company in one request, but a company's row must show the same sales
 * figure the worksheet and the sales report show, so it takes the itemized view first and only
 * falls back to the cheaper customer-day summary when that view fails.
 */
export async function loadSpringSales(
  company: RegistryCompany,
  springToken: string,
  taxYear: number,
): Promise<{ sales: SttSales | null; reason: string | null }> {
  const cacheKey = `${company.companyId}:${taxYear}`;
  const cached = channelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) return { sales: cached.sales, reason: null };

  const itemized = await loadSpringSalesItemized(company, springToken, taxYear);
  if (itemized.sales) {
    channelCache.set(cacheKey, { at: Date.now(), sales: itemized.sales });
    return itemized;
  }

  const channel = await loadSpringSalesByChannel(company, springToken, taxYear);
  channelCache.set(cacheKey, { at: Date.now(), sales: channel.sales });
  return channel.sales
    ? channel
    : { sales: null, reason: `${itemized.reason}; ${channel.reason}` };
}


