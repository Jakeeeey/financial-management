import "server-only";

/**
 * Directus access for the FM taxation desk.
 *
 * Server-only: the static token must never reach a client bundle. Every route in this
 * module goes through this client, so the module has one place that knows the base
 * URL, the error shape and the field rules.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export class DirectusError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.body = body;
  }
}

export type DirectusList<T> = {
  data?: T[];
  meta?: { filter_count?: number | string };
};

function assertConfigured() {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
}

export async function directusFetch<T>(path: string, init?: RequestInit): Promise<T> {
  assertConfigured();

  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new DirectusError(`Directus request failed (${response.status})`, response.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Reads a collection page. `fields` must be explicit: `fields=*` is forbidden on this instance. */
export async function listItems<T>(
  collection: string,
  options: {
    fields: string[];
    filter?: Record<string, unknown>;
    sort?: string;
    limit?: number;
    page?: number;
  },
): Promise<{ rows: T[]; total: number }> {
  const limit = options.limit ?? 100;
  const page = options.page ?? 1;
  const query = queryString({
    fields: options.fields.join(","),
    filter: options.filter ? JSON.stringify(options.filter) : undefined,
    sort: options.sort,
    limit,
    page,
    meta: "filter_count",
  });

  const response = await directusFetch<DirectusList<T>>(`/items/${collection}${query}`);
  const total = Number(response.meta?.filter_count ?? response.data?.length ?? 0);
  return { rows: response.data ?? [], total };
}

export function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return value == null ? "" : String(value).trim();
}

export function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asNumber(value: unknown, fallback = 0): number {
  return asNumberOrNull(value) ?? fallback;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
