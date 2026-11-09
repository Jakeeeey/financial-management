import "server-only";

import { groupedByDate } from "./companyClient";
import { loadFigures } from "./companyFigures";
import { loadProfile } from "./profile.service";
import { computeTax, computeVat } from "./taxEngine";
import { buildObligations, calendarNotices, type CompanyCalendarInput } from "./calendar.service";
import { asString, listItems } from "./directus";
import { listRegistryCompaniesWithHealth } from "./registry";
import { phtToday } from "../pht";
import type { CalendarObligation, RegistryCompany } from "../types";

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
async function loadMonthlyWithholding(company: RegistryCompany, taxYear: number): Promise<number[]> {
  const months = new Array<number>(12).fill(0);
  try {
    const rows = await groupedByDate(
      company.baseUrl,
      company.token,
      company.code,
      "purchase_order",
      "date",
      { withholding_tax_amount: "sum" },
      `${taxYear}-01-01`,
      `${taxYear}-12-31`,
    );
    for (const row of rows) {
      const month = Number(row.date.slice(5, 7));
      if (month >= 1 && month <= 12) months[month - 1] += row.sums.withholding_tax_amount ?? 0;
    }
  } catch {
    return months;
  }
  return months;
}

async function buildCompanyInput(company: RegistryCompany, taxYear: number): Promise<CompanyCalendarInput> {
  const profile = await loadProfile(company.companyId, taxYear);

  if (!company.reachable) {
    const empty = [0, 1, 2, 3].map(() => ({
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
    }));
    return {
      company,
      profile,
      computation: computeTax(empty, profile),
      vat: computeVat(empty, profile),
      monthlyWithholding: new Array<number>(12).fill(0),
      quarterlySales: [0, 0, 0, 0],
    };
  }

  const [{ figures }, monthlyWithholding] = await Promise.all([
    loadFigures(company, taxYear, []),
    loadMonthlyWithholding(company, taxYear),
  ]);

  return {
    company,
    profile,
    computation: computeTax(figures, profile),
    vat: computeVat(figures, profile),
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

/** Every filing in the group for one tax year, across every company the registry knows. */
export async function listCalendar(taxYear: number, companyId: number | null): Promise<CalendarResult> {
  const today = phtToday();
  const [companies, paidKeys] = await Promise.all([listRegistryCompaniesWithHealth(), loadPaidKeys(taxYear)]);

  const scoped = companyId ? companies.filter((company) => company.companyId === companyId) : companies;
  const notices = calendarNotices(taxYear);

  const obligations: CalendarObligation[] = [];
  for (const company of scoped) {
    try {
      const input = await buildCompanyInput(company, taxYear);
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
