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

function base(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function requestJson<T>(baseUrl: string, token: string, path: string, companyCode: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base(baseUrl)}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
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

/** True when the instance answers its own ping. */
export async function ping(baseUrl: string, token: string): Promise<{ ok: boolean; reason: string | null }> {
  // Directus answers /server/ping with the plain text "pong", not JSON, so this cannot
  // go through requestJson: parsing it would throw and report a healthy instance as down.
  try {
    const response = await fetch(`${base(baseUrl)}/server/ping`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, reason: `refused the ping (${response.status})` };
    return { ok: true, reason: null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

type GroupedRow = { date?: string | null; sum?: Record<string, number | string> };

/**
 * Sums several money fields per distinct date value in one request.
 * The caller buckets the dates into quarters, so a whole year costs one round trip.
 */
export async function groupedByDate(
  baseUrl: string,
  token: string,
  companyCode: string,
  collection: string,
  dateField: string,
  sums: Record<string, "sum">,
  from: string,
  to: string,
  extraFilter?: Record<string, unknown>,
): Promise<Array<{ date: string; sums: Record<string, number> }>> {
  const params = new URLSearchParams();
  const filter: Record<string, unknown> = {
    _and: [{ [dateField]: { _gte: from } }, { [dateField]: { _lte: to } }, ...(extraFilter ? [extraFilter] : [])],
  };
  params.set("filter", JSON.stringify(filter));
  params.set("groupBy", dateField);
  params.set("limit", "-1");
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
      // Directus names the group key after the field itself (`invoice_date`), never `date`,
      // so reading `row.date` alone silently zeroed every collection whose date column is not
      // literally called "date".
      const key = (row as Record<string, unknown>)[dateField] ?? row.date;
      return { date: String(key ?? ""), sums: values };
    })
    .filter((row) => row.date.length >= 7);
}

/** Reads a bounded list. Used only for small lookup tables. */
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
