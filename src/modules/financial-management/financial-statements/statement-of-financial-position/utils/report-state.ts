import type { BalanceSheetFilterState } from "../types/balance-sheet.schema";

const REPORTING_TIME_ZONE = "Asia/Manila";

export function getBalanceSheetTodayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getBalanceSheetPreviousYearDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const previousYear = year - 1;
  const lastDayOfMonth = new Date(Date.UTC(previousYear, month, 0)).getUTCDate();
  return `${previousYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDayOfMonth)).padStart(2, "0")}`;
}

export function getBalanceSheetMonthEnd(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getBalanceSheetYearOptions(selectedYear: number, now = new Date()): number[] {
  const currentYear = Number(getBalanceSheetTodayDate(now).slice(0, 4));
  const years = Array.from({ length: 12 }, (_, index) => currentYear + 1 - index);
  return Array.from(new Set([...years, selectedYear])).sort((a, b) => b - a);
}

export function createDefaultBalanceSheetFilters(asOfDate = getBalanceSheetTodayDate()): BalanceSheetFilterState {
  const [year] = asOfDate.split("-");
  const comparisonEndDate = getBalanceSheetPreviousYearDate(asOfDate);
  const [comparisonYear] = comparisonEndDate.split("-");

  return {
    startDate: `${year}-01-01`,
    endDate: asOfDate,
    status: "Posted",
    includeComparison: true,
    divisionName: "",
    departmentName: "",
    comparisonStartDate: `${comparisonYear}-01-01`,
    comparisonEndDate,
    dataBasis: "today",
    comparisonBasis: "match",
  };
}

const REPORT_QUERY_KEYS = [
  "startDate",
  "endDate",
  "status",
  "includeComparison",
  "divisionName",
  "departmentName",
  "comparisonStartDate",
  "comparisonEndDate",
  "dataBasis",
  "comparisonBasis",
] as const;

const FILTER_FIELDS = [
  "startDate",
  "endDate",
  "status",
  "includeComparison",
  "divisionName",
  "departmentName",
  "comparisonStartDate",
  "comparisonEndDate",
  "dataBasis",
  "comparisonBasis",
] as const satisfies readonly (keyof BalanceSheetFilterState)[];

export type BalanceSheetFilterChipKey = "period" | "comparison" | "status" | "divisionName" | "departmentName";

export interface BalanceSheetFilterChip {
  key: BalanceSheetFilterChipKey;
  label: string;
}

export interface ParsedBalanceSheetUrl {
  filters: BalanceSheetFilterState;
  hasReportCriteria: boolean;
}

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function parseBalanceSheetUrl(
  params: URLSearchParams,
  defaultFilters: BalanceSheetFilterState,
): ParsedBalanceSheetUrl {
  const hasReportCriteria = REPORT_QUERY_KEYS.some(key => params.has(key));
  if (!hasReportCriteria) {
    return { filters: { ...defaultFilters }, hasReportCriteria: false };
  }

  const dataBasis = params.get("dataBasis");
  const comparisonBasis = params.get("comparisonBasis");
  const includeComparisonValue = params.get("includeComparison");

  return {
    hasReportCriteria: true,
    filters: {
      startDate: isDate(params.get("startDate")) ? params.get("startDate")! : defaultFilters.startDate,
      endDate: isDate(params.get("endDate")) ? params.get("endDate")! : defaultFilters.endDate,
      status: params.get("status") ?? defaultFilters.status,
      includeComparison: includeComparisonValue === "false"
        ? false
        : includeComparisonValue === "true"
          ? true
          : defaultFilters.includeComparison,
      divisionName: (params.get("divisionName") ?? "").toLowerCase() === "all" ? "" : params.get("divisionName") ?? "",
      departmentName: (params.get("departmentName") ?? "").toLowerCase() === "all" ? "" : params.get("departmentName") ?? "",
      comparisonStartDate: isDate(params.get("comparisonStartDate"))
        ? params.get("comparisonStartDate")!
        : defaultFilters.comparisonStartDate,
      comparisonEndDate: isDate(params.get("comparisonEndDate"))
        ? params.get("comparisonEndDate")!
        : defaultFilters.comparisonEndDate,
      dataBasis: dataBasis === "today"
        ? "today"
        : dataBasis === "monthly" || dataBasis === "quarterly" || dataBasis === "annually"
          ? dataBasis
          : dataBasis === "as-of" || dataBasis === "manual"
            ? "manual"
            : defaultFilters.dataBasis,
      comparisonBasis: comparisonBasis === "match"
        ? "match"
        : comparisonBasis === "as-of" || comparisonBasis === "manual"
          ? "as-of"
          : defaultFilters.comparisonBasis,
    },
  };
}

export function writeBalanceSheetFiltersToSearchParams(
  params: URLSearchParams,
  filters: BalanceSheetFilterState,
) {
  for (const key of REPORT_QUERY_KEYS) params.delete(key);

  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  params.set("status", filters.status);
  params.set("includeComparison", String(filters.includeComparison));
  params.set("comparisonStartDate", filters.comparisonStartDate);
  params.set("comparisonEndDate", filters.comparisonEndDate);
  params.set("dataBasis", filters.dataBasis);
  params.set("comparisonBasis", filters.comparisonBasis);
  if (filters.divisionName) params.set("divisionName", filters.divisionName);
  if (filters.departmentName) params.set("departmentName", filters.departmentName);
}

export function hasPendingBalanceSheetChanges(
  draft: BalanceSheetFilterState,
  applied: BalanceSheetFilterState | null,
): boolean {
  if (applied === null) return false;
  return FILTER_FIELDS.some(field => draft[field] !== applied[field]);
}

export function getBalanceSheetAppliedFilterChips(
  filters: BalanceSheetFilterState,
): BalanceSheetFilterChip[] {
  const chips: BalanceSheetFilterChip[] = [];

  chips.push({ key: "period", label: `As of ${formatReportDate(filters.endDate)}` });

  if (filters.includeComparison) {
    chips.push({
      key: "comparison",
      label: `Comparison as of ${formatReportDate(filters.comparisonEndDate)}`,
    });
  }

  if (filters.status !== "Posted") {
    chips.push({ key: "status", label: `Status: ${filters.status || "All"}` });
  }
  if (filters.divisionName) chips.push({ key: "divisionName", label: `Division: ${filters.divisionName}` });
  if (filters.departmentName) chips.push({ key: "departmentName", label: `Department: ${filters.departmentName}` });

  return chips;
}

export function removeBalanceSheetFilterChip(
  filters: BalanceSheetFilterState,
  key: BalanceSheetFilterChipKey,
  defaultFilters: BalanceSheetFilterState,
): BalanceSheetFilterState {
  switch (key) {
    case "period":
      return {
        ...filters,
        startDate: defaultFilters.startDate,
        endDate: defaultFilters.endDate,
        dataBasis: defaultFilters.dataBasis,
        ...(filters.comparisonBasis === "match" && {
          comparisonStartDate: defaultFilters.comparisonStartDate,
          comparisonEndDate: defaultFilters.comparisonEndDate,
        }),
      };
    case "comparison":
      return { ...filters, includeComparison: false };
    case "status":
      return { ...filters, status: defaultFilters.status };
    case "divisionName":
      return { ...filters, divisionName: "" };
    case "departmentName":
      return { ...filters, departmentName: "" };
  }
}
