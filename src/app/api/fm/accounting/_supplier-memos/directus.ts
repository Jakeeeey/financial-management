export class MemoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type Row = Record<string, unknown>;

export function directusBase() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base || !process.env.DIRECTUS_STATIC_TOKEN) throw new MemoError("Supplier memo service is not configured.", 503);
  return base;
}

export async function directus<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(directusBase() + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + process.env.DIRECTUS_STATIC_TOKEN,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new MemoError(payload?.errors?.[0]?.message || "Supplier memo data service is unavailable.",
      response.status === 403 ? 503 : response.status);
  }
  return response.json() as Promise<T>;
}

export async function readRows<T = Row>(collection: string, filter: Row, fields: string, sort = "id"): Promise<T[]> {
  return readList<T>("/items/" + collection, filter, fields, sort);
}

export async function readList<T = Row>(path: string, filter: Row, fields: string, sort = "id"): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ filter: JSON.stringify(filter), fields, sort, limit: "100", page: String(page) });
    const response = await directus<{ data: T[] }>(path + "?" + query);
    result.push(...response.data);
    if (response.data.length < 100) return result;
  }
}

export async function readByIds<T = Row>(collection: string, ids: number[], fields: string): Promise<T[]> {
  const result: T[] = [];
  const unique = [...new Set(ids.filter(id => id > 0))];
  const key = collection === "user" ? "user_id" : collection === "chart_of_accounts" ? "coa_id" : "id";
  for (let index = 0; index < unique.length; index += 100) {
    result.push(...await readRows<T>(collection, { [key]: { _in: unique.slice(index, index + 100) } }, fields, key));
  }
  return result;
}

export function relationId(value: unknown): number {
  if (value && typeof value === "object") {
    const row = value as Row;
    return Number(row.id ?? row.user_id ?? row.coa_id) || 0;
  }
  return Number(value) || 0;
}

export function positiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new MemoError("A valid record ID is required.");
  return id;
}
