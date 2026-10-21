import { FilterState, PresetRange } from "../types";

export function createDefaultFilterState(now = new Date()): FilterState {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    search: "",
    startDate: formatLocalDate(firstDay),
    endDate: formatLocalDate(lastDay),
    presetRange: "Monthly",
    selectedMonth: now.getMonth(),
    selectedQuarter: Math.floor(now.getMonth() / 3) + 1,
    selectedYear: now.getFullYear(),
    branch: "All Branches",
    division: "All Divisions",
    department: "All Departments",
    coa: "All Accounts",
    sourceModule: "All Source Modules",
    status: "All Statuses",
    sortField: "date",
    sortOrder: "desc",
  };
}

export function normalizeFilterDates(filters: FilterState): FilterState {
  if (filters.presetRange === "Custom") return filters;

  let start = new Date(filters.selectedYear, 0, 1);
  let end = new Date(filters.selectedYear, 11, 31);
  if (filters.presetRange === "Monthly") {
    start = new Date(filters.selectedYear, filters.selectedMonth, 1);
    end = new Date(filters.selectedYear, filters.selectedMonth + 1, 0);
  } else if (filters.presetRange === "Quarterly") {
    const startMonth = (filters.selectedQuarter - 1) * 3;
    start = new Date(filters.selectedYear, startMonth, 1);
    end = new Date(filters.selectedYear, startMonth + 3, 0);
  }

  return { ...filters, startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
}

export function parseJournalEntryUrlState(params: URLSearchParams, now = new Date()) {
  const defaults = createDefaultFilterState(now);
  const preset = params.get("presetRange");
  const sortOrder = params.get("sortOrder");
  const status = params.get("status");
  const oldPostedOnly = params.get("showPostedOnly") === "true";
  const page = parseNonNegativeInteger(params.get("page"), 0);
  const requestedPageSize = parseNonNegativeInteger(params.get("pageSize"), 10);
  const pageSize = [10, 20, 30, 40, 50].includes(requestedPageSize) ? requestedPageSize : 10;

  const filters: FilterState = {
      ...defaults,
      search: params.get("search") ?? defaults.search,
      startDate: getDateParam(params.get("startDate"), defaults.startDate),
      endDate: getDateParam(params.get("endDate"), defaults.endDate),
      presetRange: isPresetRange(preset) ? preset : defaults.presetRange,
      selectedMonth: clamp(parseNonNegativeInteger(params.get("selectedMonth"), defaults.selectedMonth), 0, 11),
      selectedQuarter: clamp(parseNonNegativeInteger(params.get("selectedQuarter"), defaults.selectedQuarter), 1, 4),
      selectedYear: parsePositiveInteger(params.get("selectedYear"), defaults.selectedYear),
      branch: params.get("branch") ?? defaults.branch,
      division: params.get("division") ?? defaults.division,
      department: params.get("department") ?? defaults.department,
      coa: params.get("coa") ?? defaults.coa,
      sourceModule: params.get("sourceModule") ?? defaults.sourceModule,
      status: oldPostedOnly && (!status || status === "All Statuses")
        ? "Posted"
        : status ?? defaults.status,
      accountNumber: params.get("accountNumber") || undefined,
      sortField: params.get("sortField") || defaults.sortField,
      sortOrder: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : defaults.sortOrder,
    };

  return {
    filters: normalizeFilterDates(filters),
    page,
    pageSize,
  };
}

export function serializeJournalEntryUrlState(filters: FilterState, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  params.set("presetRange", filters.presetRange);
  params.set("selectedMonth", String(filters.selectedMonth));
  params.set("selectedQuarter", String(filters.selectedQuarter));
  params.set("selectedYear", String(filters.selectedYear));
  params.set("sortField", filters.sortField);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status !== "All Statuses") params.set("status", filters.status);
  if (filters.branch !== "All Branches") params.set("branch", filters.branch);
  if (filters.division !== "All Divisions") params.set("division", filters.division);
  if (filters.department !== "All Departments") params.set("department", filters.department);
  if (filters.coa !== "All Accounts") params.set("coa", filters.coa);
  if (filters.sourceModule !== "All Source Modules") params.set("sourceModule", filters.sourceModule);
  if (filters.accountNumber) params.set("accountNumber", filters.accountNumber);

  return params.toString();
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseNonNegativeInteger(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDateParam(value: string | null, fallback: string) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isPresetRange(value: string | null): value is PresetRange {
  return value === "Monthly" || value === "Quarterly" || value === "Yearly" || value === "Custom";
}
