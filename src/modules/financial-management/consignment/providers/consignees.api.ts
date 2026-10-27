import type { ConsigneeDetail, ConsigneePage, ConsigneeQuery } from "../types";

export class ConsigneeReadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/fm/consignment/consignees${path}`, { cache: "no-store", signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 403 ? "You do not have access to Consignees."
      : response.status === 401 ? "Your session is unavailable. Please sign in again."
      : typeof payload?.message === "string" ? payload.message : "Unable to load consignees. Please retry.";
    throw new ConsigneeReadError(message, response.status);
  }
  if (payload === null) throw new ConsigneeReadError("The server returned an unavailable response. Please retry.", 502);
  return payload as T;
}

export function listConsignees(query: ConsigneeQuery, signal: AbortSignal) {
  return get<ConsigneePage>(`?${new URLSearchParams({ search: query.search, page: String(query.page), pageSize: String(query.pageSize) })}`, signal);
}

export function getConsignee(id: string, signal: AbortSignal) {
  return get<ConsigneeDetail>(`/${encodeURIComponent(id)}`, signal);
}
