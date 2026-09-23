import type { LogisticsWerDispatchPlan } from "@/modules/financial-management/reports/logistics-wer/types";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface DirectusList<T> {
  data?: T[];
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

export async function getDispatchPlans(startDate: string, endDate: string): Promise<LogisticsWerDispatchPlan[]> {
  const params = new URLSearchParams({
    limit: "-1",
    sort: "-time_of_dispatch,-date_encoded,-id",
    fields: "id,doc_no,driver_id,vehicle_id,status,time_of_dispatch,date_encoded,remarks,amount,is_liquidated",
  });
  params.set("filter[_or][0][time_of_dispatch][_gte]", dateTimeBoundary(startDate, false));
  params.set("filter[_or][0][time_of_dispatch][_lte]", dateTimeBoundary(endDate, true));
  params.set("filter[_or][1][date_encoded][_gte]", dateTimeBoundary(startDate, false));
  params.set("filter[_or][1][date_encoded][_lte]", dateTimeBoundary(endDate, true));

  const response = await directusFetch<DirectusList<DirectusDispatchPlanRow>>(
    `/items/post_dispatch_plan?${params.toString()}`,
  );
  const rows = response.data ?? [];
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

  const userMap = new Map((users.data ?? []).map((user) => [asNumber(user.user_id), user]));
  const vehicleMap = new Map((vehicles.data ?? []).map((vehicle) => [asNumber(vehicle.vehicle_id), vehicle]));

  return rows
    .map((row) => normalizePlan(row, userMap, vehicleMap))
    .filter((plan): plan is LogisticsWerDispatchPlan => Boolean(plan))
    .filter((plan) => !plan.dispatchDate || (plan.dispatchDate >= startDate && plan.dispatchDate <= endDate));
}
