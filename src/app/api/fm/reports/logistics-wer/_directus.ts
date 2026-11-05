import type { LogisticsWerDispatchPlan } from "@/modules/financial-management/reports/logistics-wer/types";
import { LOGISTICS_WER_VISIBLE_STATUSES } from "@/modules/financial-management/reports/logistics-wer/utils/status";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface DirectusList<T> {
  data?: T[];
  meta?: { filter_count?: number | string };
}

type RelationValue = number | string | null | {
  user_id?: unknown;
  vehicle_id?: unknown;
  vehicle_plate?: unknown;
  name?: unknown;
};

interface DirectusDispatchPlanRow {
  id?: unknown;
  doc_no?: unknown;
  driver_id?: RelationValue;
  vehicle_id?: RelationValue;
  status?: unknown;
  time_of_dispatch?: unknown;
  date_encoded?: unknown;
  remarks?: unknown;
  amount?: unknown;
  is_liquidated?: unknown;
}

interface DirectusUserRow {
  user_id?: unknown;
  user_fname?: unknown;
  user_mname?: unknown;
  user_lname?: unknown;
}

interface DirectusVehicleRow {
  vehicle_id?: unknown;
  vehicle_plate?: unknown;
  name?: unknown;
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

function asId(value: unknown, nestedKey: "user_id" | "vehicle_id" = "user_id"): number | null {
  if (typeof value === "object" && value !== null) {
    const relation = value as Record<string, unknown>;
    const id = Number(relation[nestedKey] ?? relation.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function directusFetch<T>(path: string): Promise<T> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const response = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Directus request failed (${response.status}): ${body || response.statusText}`);
  }
  if (!body.trim()) return {} as T;
  return JSON.parse(body) as T;
}

function dateTimeBoundary(date: string, endOfDay: boolean): string {
  return `${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`;
}

function directusFilterCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function toManilaDateOnly(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

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

function timestampValue(value: unknown): number {
  const raw = asString(value);
  if (!raw) return 0;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizePlan(
  row: DirectusDispatchPlanRow,
  users: Map<number, DirectusUserRow>,
  vehicles: Map<number, DirectusVehicleRow>,
): LogisticsWerDispatchPlan | null {
  const id = asNumber(row.id);
  const docNo = asString(row.doc_no);
  if (!id || !docNo) return null;

  const driver = users.get(asId(row.driver_id) || 0);
  const vehicle = vehicles.get(asId(row.vehicle_id, "vehicle_id") || 0);
  const driverName = [driver?.user_fname, driver?.user_mname, driver?.user_lname]
    .map(asString)
    .filter(Boolean)
    .join(" ");

  return {
    id,
    docNo,
    dispatchDate: toManilaDateOnly(row.time_of_dispatch) || toManilaDateOnly(row.date_encoded),
    timeOfDispatch: asNullableString(row.time_of_dispatch),
    driverName: driverName || null,
    vehicleName: asNullableString(vehicle?.vehicle_plate) || asNullableString(vehicle?.name),
    status: asNullableString(row.status),
    remarks: asNullableString(row.remarks),
    amount: asNumber(row.amount),
    isLiquidated: row.is_liquidated === null || row.is_liquidated === undefined
      ? null
      : Number(row.is_liquidated) === 1,
  };
}

export interface DispatchPlanPageQuery {
  startDate: string;
  endDate: string;
  status: string;
  search: string;
  page: number;
  size: number;
}

export interface DispatchPlanPage {
  content: LogisticsWerDispatchPlan[];
  totalElements: number;
}

interface DispatchPlanPartition {
  rows: DirectusDispatchPlanRow[];
  total: number;
}

function dispatchPlanStatus(status: string): string | null {
  if (!status || status.toUpperCase() === "ALL") return null;
  return LOGISTICS_WER_VISIBLE_STATUSES.find((candidate) => candidate.toLowerCase() === status.toLowerCase()) ?? "";
}

async function getMatchingDriverIds(search: string): Promise<number[]> {
  const tokens = search.split(/\s+/).filter(Boolean);
  const params = new URLSearchParams({
    limit: "-1",
    fields: "user_id,user_fname,user_mname,user_lname",
  });
  tokens.forEach((token, tokenIndex) => {
    for (const [fieldIndex, field] of ["user_fname", "user_mname", "user_lname"].entries()) {
      params.set(`filter[_and][${tokenIndex}][_or][${fieldIndex}][${field}][_icontains]`, token);
    }
  });
  const result = await directusFetch<DirectusList<DirectusUserRow>>(`/items/user?${params.toString()}`);
  return (result.data ?? [])
    .filter((user) => [user.user_fname, user.user_mname, user.user_lname].map(asString).filter(Boolean).join(" ").toLowerCase().includes(search))
    .map((user) => asNumber(user.user_id))
    .filter((id) => id > 0);
}

async function getMatchingVehicleIds(search: string): Promise<number[]> {
  const params = new URLSearchParams({
    limit: "-1",
    fields: "vehicle_id,vehicle_plate,name",
  });
  params.set("filter[_or][0][vehicle_plate][_icontains]", search);
  params.set("filter[_or][1][name][_icontains]", search);
  const result = await directusFetch<DirectusList<DirectusVehicleRow>>(`/items/vehicles?${params.toString()}`);
  return (result.data ?? [])
    .filter((vehicle) => (asString(vehicle.vehicle_plate) || asString(vehicle.name)).toLowerCase().includes(search))
    .map((vehicle) => asNumber(vehicle.vehicle_id))
    .filter((id) => id > 0);
}

async function fetchPlanPartition(
  query: DispatchPlanPageQuery,
  timeIsSet: boolean,
  prefixSize: number,
  driverIds: number[] | null,
  vehicleIds: number[] | null,
): Promise<DispatchPlanPartition> {
  const params = new URLSearchParams({
    limit: String(prefixSize),
    offset: "0",
    sort: timeIsSet ? "-time_of_dispatch,-id" : "-date_encoded,-id",
    meta: "filter_count",
    fields: "id,doc_no,driver_id,vehicle_id,status,time_of_dispatch,date_encoded,remarks,amount,is_liquidated",
  });
  params.set("filter[status][_in]", LOGISTICS_WER_VISIBLE_STATUSES.join(","));
  if (query.status.toUpperCase() !== "ALL") {
    const exactStatus = dispatchPlanStatus(query.status);
    if (!exactStatus) return { rows: [], total: 0 };
    params.delete("filter[status][_in]");
    params.set("filter[status][_eq]", exactStatus);
  }
  if (timeIsSet) {
    params.set("filter[time_of_dispatch][_nnull]", "true");
    params.set("filter[time_of_dispatch][_gte]", dateTimeBoundary(query.startDate, false));
    params.set("filter[time_of_dispatch][_lte]", dateTimeBoundary(query.endDate, true));
  } else {
    params.set("filter[time_of_dispatch][_null]", "true");
    params.set("filter[date_encoded][_gte]", dateTimeBoundary(query.startDate, false));
    params.set("filter[date_encoded][_lte]", dateTimeBoundary(query.endDate, true));
  }

  if (query.search) {
    let orIndex = 0;
    params.set(`filter[_or][${orIndex}][doc_no][_icontains]`, query.search);
    orIndex += 1;
    if (driverIds?.length) {
      params.set(`filter[_or][${orIndex}][driver_id][_in]`, driverIds.join(","));
      orIndex += 1;
    }
    if (vehicleIds?.length) {
      params.set(`filter[_or][${orIndex}][vehicle_id][_in]`, vehicleIds.join(","));
    }
  }

  const result = await directusFetch<DirectusList<DirectusDispatchPlanRow>>(
    `/items/post_dispatch_plan?${params.toString()}`,
  );
  return { rows: result.data ?? [], total: directusFilterCount(result.meta?.filter_count) };
}

async function getRelatedMaps(rows: DirectusDispatchPlanRow[]) {
  const driverIds = Array.from(new Set(rows.map((row) => asId(row.driver_id)).filter((id): id is number => Boolean(id))));
  const vehicleIds = Array.from(new Set(rows.map((row) => asId(row.vehicle_id, "vehicle_id")).filter((id): id is number => Boolean(id))));
  const [users, vehicles] = await Promise.all([
    driverIds.length > 0
      ? directusFetch<DirectusList<DirectusUserRow>>(`/items/user?limit=-1&fields=user_id,user_fname,user_mname,user_lname&filter[user_id][_in]=${driverIds.join(",")}`)
      : Promise.resolve({ data: [] } as DirectusList<DirectusUserRow>),
    vehicleIds.length > 0
      ? directusFetch<DirectusList<DirectusVehicleRow>>(`/items/vehicles?limit=-1&fields=vehicle_id,vehicle_plate,name&filter[vehicle_id][_in]=${vehicleIds.join(",")}`)
      : Promise.resolve({ data: [] } as DirectusList<DirectusVehicleRow>),
  ]);
  return {
    users: new Map((users.data ?? []).map((user) => [asNumber(user.user_id), user])),
    vehicles: new Map((vehicles.data ?? []).map((vehicle) => [asNumber(vehicle.vehicle_id), vehicle])),
  };
}

export async function getDispatchPlans(query: DispatchPlanPageQuery): Promise<DispatchPlanPage> {
  const search = query.search.trim().toLowerCase();
  const [driverIds, vehicleIds] = search
    ? await Promise.all([getMatchingDriverIds(search), getMatchingVehicleIds(search)])
    : [null, null];
  const prefixSize = (query.page + 1) * query.size;
  const [timed, untimed] = await Promise.all([
    fetchPlanPartition({ ...query, search }, true, prefixSize, driverIds, vehicleIds),
    fetchPlanPartition({ ...query, search }, false, prefixSize, driverIds, vehicleIds),
  ]);
  const rows = [...timed.rows, ...untimed.rows];
  const related = await getRelatedMaps(rows);
  const content = rows
    .sort((left, right) => {
      const leftDate = toManilaDateOnly(left.time_of_dispatch) || toManilaDateOnly(left.date_encoded) || "";
      const rightDate = toManilaDateOnly(right.time_of_dispatch) || toManilaDateOnly(right.date_encoded) || "";
      const dateOrder = rightDate.localeCompare(leftDate);
      if (dateOrder) return dateOrder;

      const leftTime = asString(left.time_of_dispatch);
      const rightTime = asString(right.time_of_dispatch);
      if (leftTime && !rightTime) return -1;
      if (rightTime && !leftTime) return 1;

      const timeOrder = leftTime && rightTime
        ? timestampValue(rightTime) - timestampValue(leftTime)
        : timestampValue(right.date_encoded) - timestampValue(left.date_encoded);
      return timeOrder || asNumber(right.id) - asNumber(left.id);
    })
    .map((row) => normalizePlan(row, related.users, related.vehicles))
    .filter((plan): plan is LogisticsWerDispatchPlan => Boolean(plan))
    .slice(query.page * query.size, (query.page + 1) * query.size);

  return { content, totalElements: timed.total + untimed.total };
}
