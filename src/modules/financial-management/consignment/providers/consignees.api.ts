import type { ConsigneeDetail, ConsigneePage, ConsigneeQuery, ConsignmentWorkspace } from "../types";

export class ConsigneeReadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function get<T>(path: string, signal: AbortSignal, workspace: ConsignmentWorkspace = "consignees"): Promise<T> {
  const response = await fetch(`/api/fm/consignment/${workspace}${path}`, { cache: "no-store", signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 403 ? "You do not have access to this Consignment module."
      : response.status === 401 ? "Your session is unavailable. Please sign in again."
      : typeof payload?.message === "string" ? payload.message : "Unable to load consignees. Please retry.";
    throw new ConsigneeReadError(message, response.status);
  }
  if (payload === null) throw new ConsigneeReadError("The server returned an unavailable response. Please retry.", 502);
  return payload as T;
}

export function listConsignees(query: ConsigneeQuery, signal: AbortSignal, workspace: ConsignmentWorkspace = "consignees") {
  return get<ConsigneePage>(`?${new URLSearchParams({ search: query.search, page: String(query.page), pageSize: String(query.pageSize), status: query.status ?? "ALL" })}`, signal, workspace);
}

export function getConsignee(id: string, signal: AbortSignal, workspace: ConsignmentWorkspace = "consignees") {
  return get<ConsigneeDetail>(`/${encodeURIComponent(id)}`, signal, workspace);
}

export class ConsigneeSaveError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}

export async function saveConsignee(id: string | null, draft: import("../types").ConsigneeDraft, workspace: ConsignmentWorkspace = "consignees") {
  const response = await fetch(`/api/fm/consignment/${workspace}${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ConsigneeSaveError(payload?.message || "Unable to save the draft. Your values remain here; retry when available.", response.status, payload?.fieldErrors || {});
  return payload as ConsigneeDetail;
}

export async function consigneeCommand(workspace: ConsignmentWorkspace, id: string, action: string, version: number, reason: string, requestId: string) {
  const response = await fetch(`/api/fm/consignment/${workspace}/${encodeURIComponent(id)}/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, reason, requestId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.summary) throw new ConsigneeSaveError(payload?.message || "The action could not be confirmed. Reload the preview to check its saved status.", response.ok ? 502 : response.status, payload?.fieldErrors || {});
  return payload as ConsigneeDetail;
}
