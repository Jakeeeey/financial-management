import type { AgreementClosureReadiness, AgreementConsigneePage, AgreementDetail, AgreementDraft, AgreementPage, AgreementQuery } from "../agreement-types";

export class AgreementApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/fm/consignment/agreements${path}`, { cache: "no-store", ...init }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AgreementApiError("The server could not be reached. Your entered values remain available.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new AgreementApiError(response.status === 403 ? "You do not have access to this Agreement action. Draft editing is restricted to its creator."
    : response.status === 401 ? "Your session is unavailable. Please sign in again." : body?.message || "Unable to process the agreement. Please retry.", response.status, body?.fieldErrors || {});
  if (body === null) throw new AgreementApiError("The server response could not be verified. Reload or retry the same request.", 502);
  return body as T;
}

export function listAgreements(query: AgreementQuery, signal: AbortSignal) {
  return request<AgreementPage>(`?${new URLSearchParams({ search: query.search, status: query.status, page: String(query.page), pageSize: String(query.pageSize) })}`, { signal });
}
export function getAgreement(id: string, signal: AbortSignal) {
  return request<AgreementDetail>(`/${encodeURIComponent(id)}`, { signal });
}
export function agreementConsignees(search: string, page: number, signal: AbortSignal) {
  return request<AgreementConsigneePage>(`/consignees?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, { signal });
}
export async function saveAgreement(id: string | null, draft: AgreementDraft) {
  const detail = await request<AgreementDetail>(id ? `/${encodeURIComponent(id)}` : "", {
    method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
  });
  if (!detail?.summary?.id || !detail.consignee || !detail.terms || typeof detail.version !== "number") {
    throw new AgreementApiError("The saved draft response is incomplete. Check the register before creating another draft.", 502);
  }
  return detail;
}

function commandBody(version: number, reason?: string) {
  return JSON.stringify({ version, ...(reason !== undefined ? { reason } : {}) });
}

export async function submitAgreement(id: string, version: number) {
  return request<AgreementDetail>(`/${encodeURIComponent(id)}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: commandBody(version) });
}

export async function approveAgreement(id: string, version: number) {
  return request<AgreementDetail>(`/${encodeURIComponent(id)}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: commandBody(version) });
}

export async function rejectAgreement(id: string, version: number, reason: string) {
  return request<AgreementDetail>(`/${encodeURIComponent(id)}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: commandBody(version, reason) });
}

export async function closeAgreement(id: string, version: number, reason: string) {
  return request<AgreementDetail>(`/${encodeURIComponent(id)}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: commandBody(version, reason) });
}

export function getAgreementClosureReadiness(id: string, signal?: AbortSignal) {
  return request<AgreementClosureReadiness>(`/${encodeURIComponent(id)}/closure-readiness`, { signal });
}
