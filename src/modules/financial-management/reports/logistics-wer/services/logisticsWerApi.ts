import type {
  LogisticsWerDispatchPlan,
  LogisticsWerDispatchPlanDetail,
  LogisticsWerReportPage,
  LogisticsWerStaff,
  LogisticsWerStop,
  LogisticsWerStopItem,
} from "../types";

const ENDPOINT = "/api/fm/reports/logistics-wer";

export interface LogisticsWerReportQuery {
  startDate: string;
  endDate: string;
  search: string;
  status: string;
  page: number;
  size: number;
}

interface DispatchApprovalBudget {
  remarks?: unknown;
  amount?: unknown;
}

interface DispatchApprovalStaff {
  userId?: unknown;
  name?: unknown;
  role?: unknown;
}

interface DispatchApprovalStopItem {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  amount?: unknown;
  brand?: unknown;
  category?: unknown;
  supplier?: unknown;
}

interface DispatchApprovalStop {
  type?: unknown;
  name?: unknown;
  documentNo?: unknown;
  documentAmount?: unknown;
  sequence?: unknown;
  distance?: unknown;
  status?: unknown;
  remarks?: unknown;
  date?: unknown;
  items?: DispatchApprovalStopItem[] | null;
}

interface DispatchApprovalResponse {
  id?: unknown;
  docNo?: unknown;
  driverId?: unknown;
  vehicleId?: unknown;
  startingPoint?: unknown;
  status?: unknown;
  amount?: unknown;
  totalDistance?: unknown;
  estimatedTimeOfDispatch?: unknown;
  staff?: DispatchApprovalStaff[] | null;
  budgets?: DispatchApprovalBudget[] | null;
  stops?: DispatchApprovalStop[] | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const result = asString(value);
  return result || null;
}

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function toDateOnly(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Logistics WER request failed with status ${response.status}.`);
  }
  return payload as T;
}

export async function fetchLogisticsWerReport(query: LogisticsWerReportQuery): Promise<LogisticsWerReportPage> {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.status && query.status !== "ALL") params.set("status", query.status);

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJson<LogisticsWerReportPage>(response);
}

function mapPlan(data: DispatchApprovalResponse, sourcePlan?: LogisticsWerDispatchPlan): LogisticsWerDispatchPlan {
  const id = asNumber(data.id);

  return {
    id,
    docNo: asString(data.docNo) || sourcePlan?.docNo || "",
    dispatchDate: toDateOnly(data.estimatedTimeOfDispatch) || sourcePlan?.dispatchDate || null,
    timeOfDispatch: asNullableString(data.estimatedTimeOfDispatch) || sourcePlan?.timeOfDispatch || null,
    driverName: sourcePlan?.driverName || null,
    vehicleName: sourcePlan?.vehicleName || null,
    status: asNullableString(data.status) || sourcePlan?.status || null,
    remarks: sourcePlan?.remarks || asNullableString(data.startingPoint),
    amount: asNumber(data.amount) || sourcePlan?.amount || 0,
  };
}

function mapStaff(data: DispatchApprovalStaff): LogisticsWerStaff {
  return {
    userId: asNullableNumber(data.userId),
    name: asString(data.name) || "Unknown",
    role: asNullableString(data.role),
  };
}

function mapStopItem(data: DispatchApprovalStopItem): LogisticsWerStopItem {
  return {
    name: asString(data.name) || "Unknown item",
    quantity: asNumber(data.quantity),
    unit: asNullableString(data.unit),
    amount: asNumber(data.amount),
    brand: asNullableString(data.brand),
    category: asNullableString(data.category),
    supplier: asNullableString(data.supplier),
  };
}

function mapStop(data: DispatchApprovalStop): LogisticsWerStop {
  return {
    type: asString(data.type) || "STOP",
    name: asString(data.name) || "Unnamed stop",
    documentNo: asNullableString(data.documentNo),
    documentAmount: asNumber(data.documentAmount),
    sequence: asNullableNumber(data.sequence),
    distance: asNullableNumber(data.distance),
    status: asNullableString(data.status),
    remarks: asNullableString(data.remarks),
    date: asNullableString(data.date),
    items: (data.items ?? []).map(mapStopItem),
  };
}

function mapDetails(data: DispatchApprovalResponse, sourcePlan?: LogisticsWerDispatchPlan): LogisticsWerDispatchPlanDetail {
  const disbursements = (data.budgets ?? []).map((budget, index) => ({
    id: `budget-${index + 1}`,
    remarks: asNullableString(budget.remarks),
    amount: asNumber(budget.amount),
  }));

  return {
    plan: mapPlan(data, sourcePlan),
    disbursements,
    staff: (data.staff ?? []).map(mapStaff),
    stops: (data.stops ?? []).map(mapStop),
    disbursementTotal: disbursements.reduce((total, line) => total + line.amount, 0),
  };
}

export async function fetchLogisticsWerDetails(
  id: number,
  sourcePlan?: LogisticsWerDispatchPlan,
): Promise<LogisticsWerDispatchPlanDetail> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(String(id))}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await readJson<DispatchApprovalResponse>(response);
  return mapDetails(data, sourcePlan);
}
