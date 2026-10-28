import type {
  FinancialPerformanceFilterState,
  FinancialPerformanceReportCriteria,
} from "../types";
import {
  createDefaultFinancialPerformanceFilters,
  formatFinancialPerformanceDateRange,
  getFinancialPerformancePeriodRange,
  updateFinancialPerformanceFilters,
} from "./periods";

const REPORT_QUERY_KEYS = [
  "startDate", "endDate", "dataBasis", "status", "taxRate", "includeComparison",
  "divisionName", "departmentName", "comparisonStartDate", "comparisonEndDate", "comparisonMode",
] as const;

export type FinancialPerformanceFilterChipKey = "period" | "comparison" | "taxRate" | "status" | "divisionName" | "departmentName";

export interface FinancialPerformanceFilterChip {
  key: FinancialPerformanceFilterChipKey;
  label: string;
}

export interface ParsedFinancialPerformanceUrl {
  filters: FinancialPerformanceFilterState;
  hasCriteria: boolean;
}

export function toFinancialPerformanceReportCriteria(
  filters: FinancialPerformanceFilterState,
): FinancialPerformanceReportCriteria {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    status: filters.status,
    taxRate: filters.taxRate,
    includeComparison: filters.includeComparison,
    divisionName: filters.divisionName,
    departmentName: filters.departmentName,
    comparisonStartDate: filters.comparisonStartDate,
    comparisonEndDate: filters.comparisonEndDate,
    dataBasis: filters.dataBasis,
    comparisonMode: filters.comparisonMode,
  };
}

export function serializeFinancialPerformanceReportCriteria(
  criteria: FinancialPerformanceReportCriteria,
): string {
  const params = new URLSearchParams();
  params.set("startDate", criteria.startDate);
  params.set("endDate", criteria.endDate);
  params.set("dataBasis", criteria.dataBasis);
  params.set("status", criteria.status);
  params.set("taxRate", String(criteria.taxRate));
  params.set("includeComparison", String(criteria.includeComparison));
  params.set("divisionName", criteria.divisionName);
  params.set("departmentName", criteria.departmentName);
  params.set("comparisonStartDate", criteria.comparisonStartDate);
  params.set("comparisonEndDate", criteria.comparisonEndDate);
  params.set("comparisonMode", criteria.comparisonMode);
  return params.toString();
}

export function parseFinancialPerformanceUrl(
  params: URLSearchParams,
  now = new Date(),
): ParsedFinancialPerformanceUrl {
  const defaults = createDefaultFinancialPerformanceFilters(now);
  const hasCriteria = REPORT_QUERY_KEYS.some(key => params.has(key));
  if (!hasCriteria) return { filters: defaults, hasCriteria: false };

  const basisValues = ["manual", "monthly", "quarterly", "annually", "yearToDate"] as const;
  const comparisonValues = ["previousPeriod", "samePeriodLastYear", "custom"] as const;
  const rawTaxRate = params.get("taxRate");
  const parsedTaxRate = rawTaxRate === null ? defaults.taxRate : Number(rawTaxRate);
  const divisionName = params.get("divisionName") ?? defaults.divisionName;
  const departmentName = params.get("departmentName") ?? defaults.departmentName;
  const basis = basisValues.find(value => value === params.get("dataBasis")) ?? defaults.dataBasis;
  const comparisonMode = comparisonValues.find(value => value === params.get("comparisonMode")) ?? defaults.comparisonMode;
  const includeComparisonValue = params.get("includeComparison");
  const includeComparison = includeComparisonValue === "true"
    ? true
    : includeComparisonValue === "false"
      ? false
      : defaults.includeComparison;

  const filters = updateFinancialPerformanceFilters(defaults, {
    dataBasis: basis,
    startDate: params.get("startDate") ?? defaults.startDate,
    endDate: params.get("endDate") ?? defaults.endDate,
    status: params.get("status") ?? defaults.status,
    taxRate: Number.isFinite(parsedTaxRate) ? parsedTaxRate : defaults.taxRate,
    includeComparison,
    divisionName: divisionName.toLowerCase() === "all" ? "" : divisionName,
    departmentName: departmentName.toLowerCase() === "all" ? "" : departmentName,
    comparisonStartDate: params.get("comparisonStartDate") ?? defaults.comparisonStartDate,
    comparisonEndDate: params.get("comparisonEndDate") ?? defaults.comparisonEndDate,
    comparisonMode,
  });

  return { filters, hasCriteria: true };
}

export function hasPendingFinancialPerformanceChanges(
  draft: FinancialPerformanceFilterState,
  applied: FinancialPerformanceReportCriteria | null,
): boolean {
  return applied !== null && serializeFinancialPerformanceReportCriteria(toFinancialPerformanceReportCriteria(draft))
    !== serializeFinancialPerformanceReportCriteria(applied);
}

export function getFinancialPerformanceAppliedFilterChips(
  criteria: FinancialPerformanceReportCriteria,
  now = new Date(),
): FinancialPerformanceFilterChip[] {
  const defaults = createDefaultFinancialPerformanceFilters(now);
  const chips: FinancialPerformanceFilterChip[] = [];

  if (criteria.startDate !== defaults.startDate || criteria.endDate !== defaults.endDate) {
    chips.push({
      key: "period",
      label: `Period: ${formatFinancialPerformanceDateRange(criteria.startDate, criteria.endDate)}`,
    });
  }
  if (criteria.includeComparison) {
    const comparisonMode = criteria.comparisonMode === "previousPeriod"
      ? "Previous period"
      : criteria.comparisonMode === "custom"
        ? "Custom comparison"
        : "Same period last year";
    chips.push({
      key: "comparison",
      label: `Comparison: ${comparisonMode} · ${formatFinancialPerformanceDateRange(criteria.comparisonStartDate, criteria.comparisonEndDate)}`,
    });
  }
  if (criteria.taxRate !== defaults.taxRate) chips.push({ key: "taxRate", label: `Tax rate: ${criteria.taxRate}%` });
  if (criteria.status !== defaults.status) chips.push({ key: "status", label: `Status: ${criteria.status || "All"}` });
  if (criteria.divisionName) chips.push({ key: "divisionName", label: `Division: ${criteria.divisionName}` });
  if (criteria.departmentName) chips.push({ key: "departmentName", label: `Department: ${criteria.departmentName}` });

  return chips;
}

export function removeFinancialPerformanceFilterChip(
  filters: FinancialPerformanceFilterState,
  key: FinancialPerformanceFilterChipKey,
  now = new Date(),
): FinancialPerformanceFilterState {
  const defaults = createDefaultFinancialPerformanceFilters(now);
  switch (key) {
    case "period":
      return updateFinancialPerformanceFilters(filters, {
        dataBasis: "monthly",
        ...getFinancialPerformancePeriodRange("monthly", defaults.startDate, now),
      });
    case "comparison":
      return { ...filters, includeComparison: false };
    case "taxRate":
      return { ...filters, taxRate: defaults.taxRate };
    case "status":
      return { ...filters, status: defaults.status };
    case "divisionName":
      return { ...filters, divisionName: "" };
    case "departmentName":
      return { ...filters, departmentName: "" };
  }
}

