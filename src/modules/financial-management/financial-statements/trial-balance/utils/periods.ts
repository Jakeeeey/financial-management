import type { TrialBalanceFilterState, TrialBalancePeriodType } from "../types/trial-balance.schema";

export function getManilaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getTrialBalancePeriodRange(
  periodType: Exclude<TrialBalancePeriodType, "manual">,
  year: number,
  month: number,
  quarter: number,
  now = new Date(),
) {
  if (periodType === "yearToDate") {
    const today = getManilaDateParts(now);
    return {
      startDate: `${today.year}-01-01`,
      endDate: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
    };
  }

  const startMonth = periodType === "monthly" ? month - 1 : periodType === "quarterly" ? (quarter - 1) * 3 : 0;
  const monthCount = periodType === "monthly" ? 1 : periodType === "quarterly" ? 3 : 12;
  return {
    startDate: formatDate(new Date(Date.UTC(year, startMonth, 1))),
    endDate: formatDate(new Date(Date.UTC(year, startMonth + monthCount, 0))),
  };
}

export function getCurrentTrialBalanceMonth(now = new Date()) {
  const { year, month } = getManilaDateParts(now);
  return getTrialBalancePeriodRange("monthly", year, month, 1, now);
}

export function createDefaultTrialBalanceFilters(now = new Date()): TrialBalanceFilterState {
  return {
    search: "",
    ...getCurrentTrialBalanceMonth(now),
    periodType: "monthly",
    status: "all",
    accountCategory: "all",
    reviewFlag: "all",
    sourceModule: [],
    divisionName: "",
    departmentName: "",
    postedOnly: false,
  };
}

export function getTrialBalanceYears(selectedYear: number, now = new Date()) {
  const { year } = getManilaDateParts(now);
  const years = Array.from({ length: 12 }, (_, index) => year + 1 - index);
  return Array.from(new Set([...years, selectedYear])).sort((a, b) => b - a);
}

export function validateTrialBalanceDateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Enter both a start and end date.";

  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && formatDate(date) === value;
  };

  if (!isValidDate(startDate) || !isValidDate(endDate)) return "Enter valid dates.";
  if (startDate > endDate) return "Start date must be on or before end date.";
  return null;
}
