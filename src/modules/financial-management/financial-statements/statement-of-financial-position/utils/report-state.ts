import type { BalanceSheetFilterState } from "../types/balance-sheet.schema";

export const DEFAULT_BALANCE_SHEET_FILTERS: BalanceSheetFilterState = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "Posted",
  includeComparison: true,
  divisionName: "",
  departmentName: "",
  comparisonStartDate: "2025-01-01",
  comparisonEndDate: "2025-12-31",
  dataBasis: "annually",
  comparisonBasis: "match",
};

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

export function parseBalanceSheetUrl(params: URLSearchParams): ParsedBalanceSheetUrl {
  const hasReportCriteria = REPORT_QUERY_KEYS.some(key => params.has(key));
  if (!hasReportCriteria) {
    return { filters: { ...DEFAULT_BALANCE_SHEET_FILTERS }, hasReportCriteria: false };
  }

  const dataBasis = params.get("dataBasis");
  const comparisonBasis = params.get("comparisonBasis");
  const includeComparisonValue = params.get("includeComparison");

  return {
    hasReportCriteria: true,
    filters: {
      startDate: isDate(params.get("startDate")) ? params.get("startDate")! : DEFAULT_BALANCE_SHEET_FILTERS.startDate,
      endDate: isDate(params.get("endDate")) ? params.get("endDate")! : DEFAULT_BALANCE_SHEET_FILTERS.endDate,
      status: params.get("status") ?? DEFAULT_BALANCE_SHEET_FILTERS.status,
      includeComparison: includeComparisonValue === "false"
        ? false
        : includeComparisonValue === "true"
          ? true
          : DEFAULT_BALANCE_SHEET_FILTERS.includeComparison,
      divisionName: (params.get("divisionName") ?? "").toLowerCase() === "all" ? "" : params.get("divisionName") ?? "",
      departmentName: (params.get("departmentName") ?? "").toLowerCase() === "all" ? "" : params.get("departmentName") ?? "",
      comparisonStartDate: isDate(params.get("comparisonStartDate"))
        ? params.get("comparisonStartDate")!
        : DEFAULT_BALANCE_SHEET_FILTERS.comparisonStartDate,
      comparisonEndDate: isDate(params.get("comparisonEndDate"))
        ? params.get("comparisonEndDate")!
        : DEFAULT_BALANCE_SHEET_FILTERS.comparisonEndDate,
      dataBasis: dataBasis === "as-of" || dataBasis === "manual" || dataBasis === "monthly" || dataBasis === "quarterly" || dataBasis === "annually"
        ? dataBasis
        : DEFAULT_BALANCE_SHEET_FILTERS.dataBasis,
      comparisonBasis: comparisonBasis === "match" || comparisonBasis === "as-of" || comparisonBasis === "manual"
        ? comparisonBasis
        : DEFAULT_BALANCE_SHEET_FILTERS.comparisonBasis,
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

  if (filters.startDate !== DEFAULT_BALANCE_SHEET_FILTERS.startDate
    || filters.endDate !== DEFAULT_BALANCE_SHEET_FILTERS.endDate) {
    chips.push({
      key: "period",
      label: `Period: ${formatReportDate(filters.startDate)} – ${formatReportDate(filters.endDate)}`,
    });
  }

  if (filters.includeComparison) {
    const comparisonLabel = filters.comparisonBasis === "match"
      ? "Prior year"
      : filters.comparisonBasis === "as-of"
        ? "As of date"
        : "Custom comparison";
    chips.push({
      key: "comparison",
      label: `Comparison: ${comparisonLabel} · ${formatReportDate(filters.comparisonStartDate)} – ${formatReportDate(filters.comparisonEndDate)}`,
    });
  }

  if (filters.status !== DEFAULT_BALANCE_SHEET_FILTERS.status) {
    chips.push({ key: "status", label: `Status: ${filters.status || "All"}` });
  }
  if (filters.divisionName) chips.push({ key: "divisionName", label: `Division: ${filters.divisionName}` });
  if (filters.departmentName) chips.push({ key: "departmentName", label: `Department: ${filters.departmentName}` });

  return chips;
}

export function removeBalanceSheetFilterChip(
  filters: BalanceSheetFilterState,
  key: BalanceSheetFilterChipKey,
): BalanceSheetFilterState {
  switch (key) {
    case "period":
      return {
        ...filters,
        startDate: DEFAULT_BALANCE_SHEET_FILTERS.startDate,
        endDate: DEFAULT_BALANCE_SHEET_FILTERS.endDate,
        dataBasis: DEFAULT_BALANCE_SHEET_FILTERS.dataBasis,
        ...(filters.comparisonBasis === "match" && {
          comparisonStartDate: DEFAULT_BALANCE_SHEET_FILTERS.comparisonStartDate,
          comparisonEndDate: DEFAULT_BALANCE_SHEET_FILTERS.comparisonEndDate,
        }),
      };
    case "comparison":
      return { ...filters, includeComparison: false };
    case "status":
      return { ...filters, status: DEFAULT_BALANCE_SHEET_FILTERS.status };
    case "divisionName":
      return { ...filters, divisionName: "" };
    case "departmentName":
      return { ...filters, departmentName: "" };
  }
}
