import type { CalendarObligation } from "../types";

export interface CalendarPayload {
  obligations: CalendarObligation[];
  companies: Array<{ companyId: number; name: string; code: string; reachable: boolean }>;
  notices: string[];
  today: string;
}

export async function fetchCalendar(companyId: number | null, year: number): Promise<CalendarPayload> {
  const params = new URLSearchParams({ year: String(year) });
  if (companyId) params.set("companyId", String(companyId));

  const response = await fetch(`/api/fm/taxation/tax-calendar?${params.toString()}`, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as
    | { success: true; data: CalendarPayload }
    | { success: false; error?: string };

  if (!response.ok || !("success" in body) || !body.success) {
    throw new Error(("error" in body && body.error) || "Could not build the tax calendar.");
  }
  return body.data;
}
