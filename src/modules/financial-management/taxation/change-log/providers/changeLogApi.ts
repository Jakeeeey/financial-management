import { CHANGE_LOG_PAGE_SIZE } from "../constants";
import type { ChangeLogFilter, ChangeLogRow } from "../types";

export interface ChangeLogPayload {
  rows: ChangeLogRow[];
  total: number;
  page: number;
  notice: string | null;
  companies: Array<{ companyId: number; name: string; code: string }>;
}

function toQuery(filter: ChangeLogFilter): string {
  const params = new URLSearchParams();
  if (filter.companyId) params.set("companyId", String(filter.companyId));
  if (filter.year) params.set("year", String(filter.year));
  if (filter.entity && filter.entity !== "ALL") params.set("entity", filter.entity);
  if (filter.q) params.set("q", filter.q);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  params.set("page", String(filter.page));
  return params.toString();
}

export async function fetchChangeLog(filter: ChangeLogFilter): Promise<ChangeLogPayload> {
  const response = await fetch(`/api/fm/taxation/change-log?${toQuery(filter)}`, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as
    | { success: true; data: ChangeLogPayload }
    | { success: false; error?: string };

  if (!response.ok || !("success" in body) || !body.success) {
    throw new Error(("error" in body && body.error) || "Could not read the change log.");
  }
  return body.data;
}

export const PAGE_SIZE = CHANGE_LOG_PAGE_SIZE;
