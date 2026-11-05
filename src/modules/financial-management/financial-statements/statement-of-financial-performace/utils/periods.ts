import type {
  FinancialPerformanceFilterState,
  FinancialPerformancePeriodBasis,
  FinancialPerformanceReportCriteria,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
});

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getFinancialPerformanceToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && formatDate(date) === value;
}

export function validateFinancialPerformanceDateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Enter both a start and end date.";
  if (!isValidDate(startDate) || !isValidDate(endDate)) return "Enter valid dates.";
  if (startDate > endDate) return "Start date must be on or before end date.";
  return null;
}

export function getFinancialPerformancePeriodRange(
  basis: Exclude<FinancialPerformancePeriodBasis, "manual">,
  anchorDate: string,
  now = new Date(),
) {
  const today = getFinancialPerformanceToday(now);
  if (basis === "yearToDate") return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
  const anchor = isValidDate(anchorDate) ? anchorDate : today;
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const startMonth = basis === "monthly" ? month : basis === "quarterly" ? Math.floor(month / 3) * 3 : 0;
  const monthCount = basis === "monthly" ? 1 : basis === "quarterly" ? 3 : 12;
  return {
    startDate: formatDate(new Date(Date.UTC(year, startMonth, 1))),
    endDate: formatDate(new Date(Date.UTC(year, startMonth + monthCount, 0))),
  };
}

function shiftYear(value: string): string {
  const year = Number(value.slice(0, 4)) - 1;
  const month = Number(value.slice(5, 7)) - 1;
  const day = Math.min(Number(value.slice(8, 10)), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return formatDate(new Date(Date.UTC(year, month, day)));
}

export function updateFinancialPerformanceFilters(
  current: FinancialPerformanceFilterState,
  updates: Partial<FinancialPerformanceFilterState>,
): FinancialPerformanceFilterState {
  const next = { ...current, ...updates };
  if (next.comparisonMode === "custom" || validateFinancialPerformanceDateRange(next.startDate, next.endDate)) return next;

  const calendarBasis = next.dataBasis === "monthly" || next.dataBasis === "quarterly" || next.dataBasis === "annually" ? next.dataBasis : null;
  let range: { startDate: string; endDate: string };
  if (next.comparisonMode === "samePeriodLastYear") {
    range = calendarBasis
      ? getFinancialPerformancePeriodRange(calendarBasis, shiftYear(next.startDate))
      : { startDate: shiftYear(next.startDate), endDate: shiftYear(next.endDate) };
  } else if (calendarBasis) {
    const previousDay = formatDate(new Date(new Date(`${next.startDate}T00:00:00Z`).getTime() - DAY_MS));
    range = getFinancialPerformancePeriodRange(calendarBasis, previousDay);
  } else {
    const start = new Date(`${next.startDate}T00:00:00Z`).getTime();
    const end = new Date(`${next.endDate}T00:00:00Z`).getTime();
    range = { startDate: formatDate(new Date(start - (end - start + DAY_MS))), endDate: formatDate(new Date(start - DAY_MS)) };
  }
  return { ...next, comparisonStartDate: range.startDate, comparisonEndDate: range.endDate };
}

export function createDefaultFinancialPerformanceFilters(now = new Date()): FinancialPerformanceFilterState {
  return updateFinancialPerformanceFilters({
    searchQuery: "",
    ...getFinancialPerformancePeriodRange("monthly", getFinancialPerformanceToday(now), now),
    status: "Posted",
    taxRate: 25,
    includeComparison: true,
    divisionName: "",
    departmentName: "",
    comparisonStartDate: "",
    comparisonEndDate: "",
    dataBasis: "monthly",
    comparisonMode: "samePeriodLastYear",
  }, {});
}

export function getFinancialPerformanceYears(selectedYears: number[], now = new Date()): number[] {
  const year = Number(getFinancialPerformanceToday(now).slice(0, 4));
  return [...new Set([...Array.from({ length: 12 }, (_, index) => year + 1 - index), ...selectedYears.filter(selected => Number.isInteger(selected) && selected > 0)])]
    .sort((a, b) => b - a);
}

export function validateFinancialPerformancePeriods(filters: FinancialPerformanceFilterState): string | null {
  const periodError = validateFinancialPerformanceDateRange(filters.startDate, filters.endDate);
  if (periodError) return `Reporting period: ${periodError}`;
  if (!filters.includeComparison) return null;
  const comparisonError = validateFinancialPerformanceDateRange(filters.comparisonStartDate, filters.comparisonEndDate);
  return comparisonError ? `Comparison period: ${comparisonError}` : null;
}

export function formatFinancialPerformanceDateRange(startDate: string, endDate: string): string {
  if (validateFinancialPerformanceDateRange(startDate, endDate)) return "Enter a valid date range";
  return `${dateFormatter.format(new Date(`${startDate}T00:00:00Z`))} to ${dateFormatter.format(new Date(`${endDate}T00:00:00Z`))}`;
}

export function getFinancialPerformanceComparisonLabel(period: FinancialPerformanceReportCriteria): string {
  return period.includeComparison
    ? `Comparison (${formatFinancialPerformanceDateRange(period.comparisonStartDate, period.comparisonEndDate)})`
    : "";
}
