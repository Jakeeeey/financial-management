import type {
  CashFlowActivityFilter,
  CashFlowSortField,
  CashFlowSortOrder,
  CashFlowUrlState,
} from "../types/cash-flow.schema";
import { getCashFlowDatePresets, getCashFlowDateRangeError } from "./reporting-dates";

const CASH_FLOW_QUERY_KEYS = [
  "startDate", "endDate", "view", "search", "activity", "sortField", "sortOrder", "page", "pageSize",
] as const;

export const DEFAULT_CASH_FLOW_PAGE_SIZE = 10;

export function createDefaultCashFlowUrlState(now = new Date()): CashFlowUrlState {
  const dates = getCashFlowDatePresets(now);
  return {
    startDate: dates.monthToDateStart,
    endDate: dates.today,
    view: "statement",
    search: "",
    activity: "all",
    sortField: "transactionDate",
    sortOrder: "desc",
    page: 0,
    pageSize: DEFAULT_CASH_FLOW_PAGE_SIZE,
  };
}

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseCashFlowUrlState(params: URLSearchParams, now = new Date()): CashFlowUrlState {
  const defaults = createDefaultCashFlowUrlState(now);
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const hasValidRange = isDateOnly(startDate) && isDateOnly(endDate)
    && !getCashFlowDateRangeError(startDate, endDate);
  const activities: CashFlowActivityFilter[] = ["all", "operating", "investing", "financing", "uncategorized"];
  const view = params.get("view");
  const sortFields: CashFlowSortField[] = ["transactionDate", "netCashFlow", "cashFlowActivity"];
  const sortOrders: CashFlowSortOrder[] = ["asc", "desc"];
  const rawPage = Number(params.get("page"));
  const rawPageSize = Number(params.get("pageSize"));

  return {
    ...defaults,
    ...(hasValidRange ? { startDate, endDate } : {}),
    view: view === "transactions" ? "transactions" : "statement",
    search: params.get("search") ?? defaults.search,
    activity: activities.find(value => value === params.get("activity")) ?? defaults.activity,
    sortField: sortFields.find(value => value === params.get("sortField")) ?? defaults.sortField,
    sortOrder: sortOrders.find(value => value === params.get("sortOrder")) ?? defaults.sortOrder,
    page: Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : defaults.page,
    pageSize: ([10, 25, 50] as const).find(value => value === rawPageSize) ?? defaults.pageSize,
  };
}

export function serializeCashFlowUrlState(state: CashFlowUrlState, current = ""): string {
  const params = new URLSearchParams(current);
  for (const key of CASH_FLOW_QUERY_KEYS) params.delete(key);

  params.set("startDate", state.startDate);
  params.set("endDate", state.endDate);
  if (state.view !== "statement") params.set("view", state.view);
  if (state.search) params.set("search", state.search);
  if (state.activity !== "all") params.set("activity", state.activity);
  if (state.sortField !== "transactionDate") params.set("sortField", state.sortField);
  if (state.sortOrder !== "desc") params.set("sortOrder", state.sortOrder);
  if (state.page > 0) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_CASH_FLOW_PAGE_SIZE) params.set("pageSize", String(state.pageSize));

  return params.toString();
}
