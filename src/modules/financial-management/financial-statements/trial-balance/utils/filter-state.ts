import type { TrialBalanceFilterState, TrialBalancePeriodType, TrialBalanceReportContext } from "../types/trial-balance.schema";
import { createDefaultTrialBalanceFilters, getTrialBalancePeriodRange, validateTrialBalanceDateRange } from "./periods";

export const TRIAL_BALANCE_CATEGORIES = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses", "Other"];
export const TRIAL_BALANCE_REVIEW_FLAGS = ["Normal", "Critical"];
const STATUSES = ["Posted", "Unposted"];
const PERIOD_TYPES: TrialBalancePeriodType[] = ["manual", "monthly", "quarterly", "annually", "yearToDate"];

export type TrialBalanceFilterKey = "period" | "search" | "accountCategory" | "status" | "reviewFlag"
  | "divisionName" | "departmentName" | `sourceModule:${string}`;

export function normalizeTrialBalanceFilters(filters: TrialBalanceFilterState): TrialBalanceFilterState {
  return {
    ...filters,
    search: filters.search.trim(),
    accountCategory: filters.accountCategory === "Expense" ? "Expenses" : filters.accountCategory,
    status: filters.postedOnly ? "Posted" : filters.status,
    postedOnly: false,
    divisionName: filters.divisionName.trim(),
    departmentName: filters.departmentName.trim(),
    sourceModule: [...new Set(filters.sourceModule.map(value => value.trim()).filter(Boolean))].sort(),
  };
}

export function validateTrialBalanceFilters(filters: TrialBalanceFilterState): string | null {
  const dateError = validateTrialBalanceDateRange(filters.startDate, filters.endDate);
  if (dateError) return dateError;
  if (!["all", ...STATUSES].includes(filters.status)) return "Choose a supported transaction status.";
  if (!["all", ...TRIAL_BALANCE_CATEGORIES].includes(filters.accountCategory)) return "Choose a supported account category.";
  if (!["all", ...TRIAL_BALANCE_REVIEW_FLAGS].includes(filters.reviewFlag)) return "Choose Normal, Critical, or All Flags.";
  return null;
}

export function parseTrialBalanceUrlState(params: URLSearchParams, now = new Date()) {
  const defaults = createDefaultTrialBalanceFilters(now);
  const errors: string[] = [];
  const choice = (key: string, choices: string[]) => {
    const raw = params.get(key) || "all";
    const value = key === "accountCategory" && raw === "Expense" ? "Expenses" : raw;
    if (value === "all" || choices.includes(value)) return value;
    errors.push(`Unsupported ${key}: ${raw}.`);
    return "all";
  };
  let startDate = params.get("startDate") ?? defaults.startDate;
  let endDate = params.get("endDate") ?? defaults.endDate;
  const dateError = validateTrialBalanceDateRange(startDate, endDate);
  if (dateError) {
    errors.push(dateError);
    startDate = defaults.startDate;
    endDate = defaults.endDate;
  }
  const requestedPeriod = params.get("periodType") as TrialBalancePeriodType | null;
  let periodType = requestedPeriod && PERIOD_TYPES.includes(requestedPeriod)
    ? requestedPeriod : params.has("startDate") || params.has("endDate") ? "manual" : defaults.periodType;
  if (["monthly", "quarterly", "annually"].includes(periodType)) {
    const year = Number(startDate.slice(0, 4));
    const month = Number(startDate.slice(5, 7));
    const range = getTrialBalancePeriodRange(periodType as "monthly" | "quarterly" | "annually", year, month, Math.ceil(month / 3), now);
    if (range.startDate !== startDate || range.endDate !== endDate) periodType = "manual";
  }
  const filters = normalizeTrialBalanceFilters({
    ...defaults, startDate, endDate, periodType,
    search: params.get("search") || "",
    status: params.get("postedOnly") === "true" ? "Posted" : choice("status", STATUSES),
    accountCategory: choice("accountCategory", TRIAL_BALANCE_CATEGORIES),
    reviewFlag: choice("reviewFlag", TRIAL_BALANCE_REVIEW_FLAGS),
    divisionName: params.get("divisionName") || "",
    departmentName: params.get("departmentName") || "",
    sourceModule: params.getAll("sourceModule"),
  });
  return {
    filters,
    error: errors.length ? `${errors.join(" ")} Review the filter inputs, then Apply filters or Clear all.` : null,
  };
}

export function serializeTrialBalanceFilters(filters: TrialBalanceFilterState): string {
  const normalized = normalizeTrialBalanceFilters(filters);
  const params = new URLSearchParams({ startDate: normalized.startDate, endDate: normalized.endDate, periodType: normalized.periodType });
  for (const key of ["status", "accountCategory", "reviewFlag"] as const) {
    if (normalized[key] !== "all") params.set(key, normalized[key]);
  }
  for (const key of ["search", "divisionName", "departmentName"] as const) {
    if (normalized[key]) params.set(key, normalized[key]);
  }
  for (const source of normalized.sourceModule) params.append("sourceModule", source);
  return params.toString();
}

export function trialBalanceRequestQuery(filters: TrialBalanceFilterState): string {
  const params = new URLSearchParams(serializeTrialBalanceFilters(filters));
  params.delete("periodType");
  return params.toString();
}

export function trialBalanceUrlQuery(filters: TrialBalanceFilterState, current: string): string {
  const params = new URLSearchParams(current);
  for (const key of Object.keys(createDefaultTrialBalanceFilters())) params.delete(key);
  for (const [key, value] of new URLSearchParams(serializeTrialBalanceFilters(filters))) params.append(key, value);
  return params.toString();
}

export function getTrialBalanceAppliedFilters(context: TrialBalanceReportContext, now = new Date()) {
  const chips: { key: TrialBalanceFilterKey; label: string }[] = [];
  const defaults = createDefaultTrialBalanceFilters(now);
  if (context.startDate !== defaults.startDate || context.endDate !== defaults.endDate) {
    chips.push({ key: "period", label: `Period: ${context.startDate} to ${context.endDate}` });
  }
  if (context.search) chips.push({ key: "search", label: `Search: ${context.search}` });
  if (context.accountCategory !== "all") chips.push({ key: "accountCategory", label: `Category: ${context.accountCategory}` });
  if (context.status !== "all") chips.push({ key: "status", label: `Status: ${context.status}` });
  if (context.reviewFlag !== "all") chips.push({ key: "reviewFlag", label: `Review flag: ${context.reviewFlag}` });
  if (context.divisionName) chips.push({ key: "divisionName", label: `Division: ${context.divisionName}` });
  if (context.departmentName) chips.push({ key: "departmentName", label: `Department: ${context.departmentName}` });
  for (const source of context.sourceModule) chips.push({ key: `sourceModule:${source}`, label: `Source: ${source}` });
  return chips;
}

export function getTrialBalanceReportLabels(context: TrialBalanceReportContext): string[] {
  const status = context.status === "all" ? "All statuses (Provisional)"
    : context.status === "Posted" ? "Posted transactions" : "Unposted transactions (Provisional)";
  return [
    `Transaction scope: ${status}`,
    ...getTrialBalanceAppliedFilters(context).filter(chip => chip.key !== "period" && chip.key !== "status").map(chip => chip.label),
  ];
}

export function trialBalanceFilterReset(context: TrialBalanceReportContext, key: TrialBalanceFilterKey, now = new Date()): Partial<TrialBalanceFilterState> {
  switch (key) {
    case "period": {
      const { startDate, endDate, periodType } = createDefaultTrialBalanceFilters(now);
      return { startDate, endDate, periodType };
    }
    case "search": return { search: "" };
    case "accountCategory": return { accountCategory: "all" };
    case "status": return { status: "all", postedOnly: false };
    case "reviewFlag": return { reviewFlag: "all" };
    case "divisionName": return { divisionName: "" };
    case "departmentName": return { departmentName: "" };
    default: return { sourceModule: context.sourceModule.filter(source => source !== key.slice("sourceModule:".length)) };
  }
}
