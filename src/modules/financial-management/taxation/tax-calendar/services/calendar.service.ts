import "server-only";

import { PERCENTAGE_TAX_RATE } from "../constants";
import { addDays, endOfMonth, holidaysFor, HOLIDAY_CAVEAT, isoOf, moveToWorkingDay } from "./holidays";
import type {
  CalendarCategory,
  CalendarObligation,
  CalendarStatus,
  EntityProfile,
  RegistryCompany,
  TaxComputation,
  VatComputation,
} from "../types";

/** Everything the calendar needs from one company, already fetched. */
export interface CompanyCalendarInput {
  company: RegistryCompany;
  profile: EntityProfile;
  computation: TaxComputation;
  vat: VatComputation;
  /** Withholding recorded on purchase orders, 12 entries, January first. */
  monthlyWithholding: number[];
  /** Total VATable sales + intercompany sales per quarter, for the percentage tax. */
  quarterlySales: number[];
}

const EFPS_DAY: Record<string, number> = { A: 15, B: 14, C: 13, D: 12, E: 11 };

const QUARTER_LABEL = ["Q1", "Q2", "Q3", "Q4"];

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Monthly BIR forms file by a day-of-month; eFPS groups shift that day. */
function monthlyDueDay(profile: EntityProfile): number {
  return EFPS_DAY[profile.efpsGroup] ?? 10;
}

export function paymentKey(companyId: number, formCode: string, periodKey: string): string {
  return `${companyId}|${formCode}|${periodKey}`;
}

function statusOf(dueDate: string, paid: boolean, today: string): CalendarStatus {
  if (paid) return "PAID";
  return dueDate < today ? "OVERDUE" : "DUE";
}

/**
 * Builds one company's filings for a tax year.
 *
 * Due dates come from the FSD's calendar table; every date is pushed to the next working
 * day with the reason kept on the row, so a moved deadline never looks arbitrary.
 */
export function buildObligations(
  input: CompanyCalendarInput,
  year: number,
  paidKeys: Set<string>,
  today: string,
): CalendarObligation[] {
  const { company, profile, computation, vat, monthlyWithholding, quarterlySales } = input;
  const holidays = holidaysFor(year);
  const rows: CalendarObligation[] = [];

  const push = (
    formCode: string,
    periodKey: string,
    periodLabel: string,
    rawDue: string,
    category: CalendarCategory,
    estimated: number | null,
    note: string | null,
  ) => {
    const moved = moveToWorkingDay(rawDue, holidays);
    const paid = paidKeys.has(paymentKey(company.companyId, formCode, periodKey));
    rows.push({
      key: `${company.companyId}-${formCode}-${periodKey}`,
      companyId: company.companyId,
      companyCode: company.code,
      companyName: company.name,
      formCode,
      periodKey,
      periodLabel,
      category,
      dueDate: moved.date,
      estimated: estimated === null ? null : round(estimated),
      status: statusOf(moved.date, paid, today),
      note: [moved.reason, note].filter(Boolean).join(" · ") || null,
    });
  };

  const vatForm = profile.vatRegistered ? "2550Q" : "2551Q";

  for (let quarter = 0; quarter < 4; quarter += 1) {
    const label = QUARTER_LABEL[quarter];
    const quarterEnd = endOfMonth(year, (quarter + 1) * 3);

    if (quarter < 3) {
      push("1702Q", label, `${label} ${year}`, addDays(quarterEnd, 60), "INCOME", computation.taxDue[quarter] ?? 0, "Cumulative income tax due for the year to date.");
    }

    push(
      vatForm,
      label,
      `${label} ${year}`,
      addDays(quarterEnd, 25),
      "VAT",
      profile.vatRegistered
        ? (vat.payable[quarter] ?? 0)
        : round((quarterlySales[quarter] ?? 0) * PERCENTAGE_TAX_RATE),
      profile.vatRegistered ? null : "Percentage tax on gross receipts (not VAT-registered).",
    );

    push("2307", label, `${label} ${year}`, addDays(quarterEnd, 20), "WITHHOLDING", null, "Certificates issued to suppliers and group companies.");

    const withholdingMonths = [quarter * 3, quarter * 3 + 1];
    const remittance = withholdingMonths.reduce((sum, month) => sum + (monthlyWithholding[month] ?? 0), 0);

    for (const month of withholdingMonths) {
      const label0 = `${String(month + 1).padStart(2, "0")} ${year}`;
      push(
        "0619-E",
        `M${String(month + 1).padStart(2, "0")}`,
        label0,
        isoOf(month === 11 ? year + 1 : year, month === 11 ? 2 : month + 2, monthlyDueDay(profile)),
        "WITHHOLDING",
        monthlyWithholding[month] ?? 0,
        null,
      );
    }

    push(
      "1601-EQ",
      label,
      `${label} ${year}`,
      endOfMonth(year, (quarter + 1) * 3 + 1),
      "WITHHOLDING",
      remittance,
      "Quarterly summary of the two 0619-E remittances above.",
    );
  }

  push("1702", "ANNUAL", `Annual ${year}`, isoOf(year + 1, 4, 15), "INCOME", computation.annual.netPosition, "Negative means an overpayment to carry over or refund.");

  for (let month = 0; month < 12; month += 1) {
    const dueMonth = month === 11 ? year + 1 : year;
    const dueDay = month === 11 ? 15 : monthlyDueDay(profile);
    push(
      "1601-C",
      `M${String(month + 1).padStart(2, "0")}`,
      `${String(month + 1).padStart(2, "0")} ${year}`,
      isoOf(dueMonth, month === 11 ? 1 : month + 2, dueDay),
      "WITHHOLDING",
      null,
      null,
    );
  }

  push("1604-C", "ANNUAL", `Annual ${year}`, isoOf(year + 1, 1, 31), "WITHHOLDING", null, "Annual compensation withholding.");
  push("1604-E", "ANNUAL", `Annual ${year}`, isoOf(year + 1, 3, 1), "WITHHOLDING", null, "Annual expanded withholding.");

  if (year + 1 === 2026) {
    push("SEC", "ANNUAL", `Annual ${year}`, isoOf(2026, 5, 29), "OTHER", null, "SEC eFAST filing under MC 9-2026.");
  }

  if (profile.ownsRealProperty) {
    for (const month of [3, 6, 9, 12]) {
      push("RPT", `M${String(month).padStart(2, "0")}`, `Due ${String(month).padStart(2, "0")} ${year}`, endOfMonth(year, month), "OTHER", null, "Real property tax instalment.");
    }
  }

  push("LGU", "ANNUAL", `Annual ${year}`, isoOf(year, 1, 20), "OTHER", null, "LGU permit and local business tax, then quarterly on the 20th.");

  return rows.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function calendarNotices(year: number): string[] {
  return [HOLIDAY_CAVEAT, `Filing dates for ${year} follow the FSD calendar table; confirm any proclamation change before filing.`];
}
