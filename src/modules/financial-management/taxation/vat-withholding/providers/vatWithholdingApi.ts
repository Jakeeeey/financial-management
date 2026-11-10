import type { VatWithholdingData } from "../types";

/** The only place the module talks to its API route. Components never fetch. */

const ENDPOINT = "/api/fm/taxation/vat-withholding";

interface ApiEnvelope {
  success: boolean;
  data?: VatWithholdingData;
  error?: string;
}

export async function fetchVatWithholding(
  companyId: number | null,
  year: number,
  signal?: AbortSignal,
  fresh = false,
): Promise<VatWithholdingData> {
  const query = new URLSearchParams({ year: String(year) });
  if (companyId != null) query.set("companyId", String(companyId));
  if (fresh) query.set("refresh", "1");
  const response = await fetch(`${ENDPOINT}?${query.toString()}`, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload.data;
}

