import type { IntercompanyPayload } from "../types";

/** Talks to this module's one route. Components never fetch. */

export class IntercompanyApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntercompanyApiError";
  }
}

interface Envelope {
  success?: boolean;
  data?: IntercompanyPayload;
  error?: string;
}

export async function fetchIntercompany(companyId: number | null, year: number): Promise<IntercompanyPayload> {
  const params = new URLSearchParams({ year: String(year) });
  if (companyId !== null) params.set("companyId", String(companyId));

  const response = await fetch(`/api/fm/taxation/intercompany?${params.toString()}`, { cache: "no-store" });
  const text = await response.text().catch(() => "");

  let payload: Envelope = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope;
    } catch {
      throw new IntercompanyApiError(`The intercompany endpoint returned a non-JSON response (${response.status}).`);
    }
  }

  if (!response.ok || !payload.success || !payload.data) {
    throw new IntercompanyApiError(
      payload.error ?? `The intercompany endpoint failed (${response.status}).`,
    );
  }
  return payload.data;
}
