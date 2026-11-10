import "server-only";

import { groupedByDate, sumFields } from "./companyClient";
import { loadFigures } from "./companyFigures";
import { loadProfile } from "./profile.service";
import { loadTaxRates } from "./taxRates.service";
import { computeTax, computeVat } from "./taxEngine";
import { buildObligations, calendarNotices, type CompanyCalendarInput } from "./calendar.service";
import { asString, listItems } from "./directus";
import { listRegistryCompaniesWithHealth } from "./registry";
import { phtToday } from "../pht";
import type { CalendarObligation, QuarterFigures, RegistryCompany } from "../types";

/** Reads the recorded payments so a filing can show as paid instead of due. */
async function loadPaidKeys(taxYear: number): Promise<Set<string>> {
  try {
    const { rows } = await listItems<Record<string, unknown>>("tax_payment", {
      fields: ["company_id", "form_code", "period_key"],
      filter: { tax_year: { _eq: taxYear } },
      limit: -1,
    });
    return new Set(
      rows.map(
        (row) => `${asString(row.company_id)}|${asString(row.form_code)}|${asString(row.period_key)}`,
      ),
    );
  } catch {
    return new Set();
  }
}

/** Withholding recorded on purchase orders, bucketed into twelve months. */
async function loadMonthlyWithholding(company: RegistryCompany, taxYear: number): Promise<(number | null)[]> {
  const months = new Array<number | null>(12).fill(null);
  const from = `${taxYear}-01-01`;
  const to = `${taxYear}-12-31`;
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
      const month = Number(row.date.slice(5, 7));
      if (month >= 1 && month <= 12) months[month - 1] = (months[month - 1] ?? 0) + (row.sums.withholding_tax_amount ?? 0);
    }
    // A register with no withheld amount anywhere cannot tell "nothing was withheld" from
    // "nobody recorded it"; the calendar says so instead of printing a confident zero.
    const recorded = await sumFields(company.baseUrl, company.token, company.code, "purchase_order", [
      "withholding_tax_amount",
    ], { _and: [{ date: { _gte: from } }, { date: { _lte: to } }, { withholding_tax_amount: { _gt: 0 } }] });
    if (!recorded.withholding_tax_amount) return new Array<number | null>(12).fill(null);
  } catch {
    return new Array<number | null>(12).fill(null);
  }
  return months;
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

async function buildCompanyInput(
  company: RegistryCompany,
  taxYear: number,
  springToken: string | null,
): Promise<CompanyCalendarInput> {
  const profile = await loadProfile(company.companyId, taxYear);

  if (!company.reachable) {
    const empty = [0, 1, 2, 3].map(emptyQuarter);
    return {
      company,
      profile,
      computation: computeTax(empty, profile),
      vat: computeVat(empty, profile),
      monthlyWithholding: new Array<number | null>(12).fill(null),
      quarterlySales: [0, 0, 0, 0],
    };
  }

  const [{ figures }, monthlyWithholding, rates] = await Promise.all([
    loadFigures(company, taxYear, [], { springToken }),
    loadMonthlyWithholding(company, taxYear),
    loadTaxRates(company, taxYear),
  ]);

  return {
    company,
    profile,
    computation: computeTax(figures, profile, rates),
    vat: computeVat(figures, profile, rates),
    monthlyWithholding,
    quarterlySales: figures.map((quarter) => quarter.sales + quarter.icSales),
  };
}

export interface CalendarResult {
  obligations: CalendarObligation[];
  companies: Array<{ companyId: number; name: string; code: string; reachable: boolean }>;
  notices: string[];
  today: string;
}

/**
 * Nine companies of registers per year, re-read on every switch. The token is not part of
 * the key: it decides whether the Spring sales view can be read, not whose filings they are.
 */
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; data: CalendarResult }>();

/** Every filing in the group for one tax year, across every company the registry knows. */
export async function listCalendar(
  taxYear: number,
  companyId: number | null,
  options: { fresh?: boolean; springToken?: string | null } = {},
): Promise<CalendarResult> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${taxYear}:${companyId ?? "all"}:${options.springToken ? options.springToken.slice(-8) : "anon"}:${day}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = await buildCalendar(taxYear, companyId, options.springToken ?? null);
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function buildCalendar(
  taxYear: number,
  companyId: number | null,
  springToken: string | null,
): Promise<CalendarResult> {
  const today = phtToday();
  const [companies, paidKeys] = await Promise.all([listRegistryCompaniesWithHealth(), loadPaidKeys(taxYear)]);

  const scoped = companyId ? companies.filter((company) => company.companyId === companyId) : companies;
  const notices = calendarNotices(taxYear);

  const obligations: CalendarObligation[] = [];
  for (const company of scoped) {
    try {
      const input = await buildCompanyInput(company, taxYear, springToken);
      const rows = buildObligations(input, taxYear, paidKeys, today);
      // A company that did not answer has no amount; zero would read as a real figure.
      if (!company.reachable) {
        for (const row of rows) row.estimated = null;
      }
      obligations.push(...rows);
    } catch (error) {
      notices.push(
        `${company.code}: filings could not be prepared (${error instanceof Error ? error.message : "unknown error"}).`,
      );
    }
  }

  obligations.sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  const unreachable = companies.filter((company) => !company.reachable);
  if (unreachable.length > 0) {
    notices.push(
      `Not readable: ${unreachable.map((company) => `${company.code} (${company.unreachableReason ?? "no answer"})`).join(", ")}. Their filings carry no estimate until the endpoint answers, rather than a zero.`,
    );
  }

  return {
    obligations,
    companies: companies.map((company) => ({
      companyId: company.companyId,
      name: company.name,
      code: company.code,
      reachable: company.reachable,
    })),
    notices,
    today,
  };
}



