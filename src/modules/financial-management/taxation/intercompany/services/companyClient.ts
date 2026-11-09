import "server-only";

/**
 * A Directus client bound to one company instance.
 *
 * The registry row carries its own base URL and token, so nothing here can
 * accidentally fall back to the FM instance the page is served from.
 */

export class CompanyRequestError extends Error {
  status: number;
  companyCode: string;

  constructor(message: string, status: number, companyCode: string) {
    super(message);
    this.name = "CompanyRequestError";
    this.status = status;
    this.companyCode = companyCode;
  }
}

/**
 * Instances on the group network answer in ~100 ms; 8 s keeps a dead host (one is down today and
 * hangs on connect) inside the shared request budget while leaving room for a slow-but-alive one.
 */
const REQUEST_TIMEOUT_MS = 8_000;

function base(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function requestJson<T>(baseUrl: string, token: string, path: string, companyCode: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base(baseUrl)}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CompanyRequestError(`Cannot reach ${companyCode}: ${message}`, 0, companyCode);
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new CompanyRequestError(
      `${companyCode} refused the request (${response.status})`,
      response.status,
      companyCode,
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Reads a bounded list. Used only for small lookup tables (customers that belong to the group). */
export async function listRows<T>(
  baseUrl: string,
  token: string,
  companyCode: string,
  collection: string,
  options: { fields: string[]; filter?: Record<string, unknown>; limit?: number },
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set("fields", options.fields.join(","));
  params.set("limit", String(options.limit ?? 200));
  if (options.filter) params.set("filter", JSON.stringify(options.filter));

  const payload = await requestJson<{ data?: T[] }>(
    baseUrl,
    token,
    `/items/${collection}?${params.toString()}`,
    companyCode,
  );
  return payload.data ?? [];
}

type GroupedRow = Record<string, unknown> & { sum?: Record<string, number | string> };

export interface KeyedDateRow {
  /** The value of `keyField` for this bucket — a customer code or a supplier name. */
  key: string;
  date: string;
  count: number;
  sums: Record<string, number>;
}

/**
 * Sums money fields per (key, date) bucket in one request.
 *
 * The ledger needs to know *which* peer and *which* month a peso came from, so the
 * buyer/seller field rides along in the group-by. A whole year for one peer set costs
 * one round trip.
 */
export async function groupedByKeyAndDate(
  baseUrl: string,
  token: string,
  companyCode: string,
  collection: string,
  keyField: string,
  dateField: string,
  sums: Record<string, "sum">,
  from: string,
  to: string,
  extraFilter?: Record<string, unknown>,
): Promise<KeyedDateRow[]> {
  const params = new URLSearchParams();
  const filter: Record<string, unknown> = {
    _and: [{ [dateField]: { _gte: from } }, { [dateField]: { _lte: to } }, ...(extraFilter ? [extraFilter] : [])],
  };
  params.set("filter", JSON.stringify(filter));
  params.append("groupBy", keyField);
  params.append("groupBy", dateField);
  params.set("limit", "-1");
  params.append("aggregate[count]", "*");
  for (const field of Object.keys(sums)) params.append("aggregate[sum]", field);

  const payload = await requestJson<{ data?: GroupedRow[] }>(
    baseUrl,
    token,
    `/items/${collection}?${params.toString()}`,
    companyCode,
  );

  return (payload.data ?? [])
    .map((row) => {
      const bag = (row.sum ?? {}) as Record<string, number | string>;
      const values: Record<string, number> = {};
      for (const field of Object.keys(sums)) {
        const raw = bag[field];
        values[field] = typeof raw === "number" ? raw : Number(raw ?? 0) || 0;
      }
      return {
        key: String(row[keyField] ?? "").trim(),
        date: String(row[dateField] ?? ""),
        count: Number(row.count ?? 0) || 0,
        sums: values,
      };
    })
    .filter((row) => row.date.length >= 7);
}
