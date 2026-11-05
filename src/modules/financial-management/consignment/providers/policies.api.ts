import type { PolicyDetail, PolicyDraft, PolicyChoices, PolicyReadiness } from "../policy-types";
export class PolicyError extends Error {
  constructor(message: string, readonly status: number, readonly fieldErrors: Record<string,string> = {}) { super(message); }
}
async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/fm/consignment/policies${path}`, { ...init, credentials: "include", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new PolicyError(body?.message || "Unable to load policy settings.", response.status, body?.fieldErrors);
  return body;
}
export const getPolicy = () => request<PolicyDetail>();
export const savePolicy = (draft: PolicyDraft) => request<PolicyDetail>("", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
export const getPolicyReadiness = () => request<PolicyReadiness>("/readiness");
export const getPolicyChoices = (kind: string, search: string, page: number, signal?: AbortSignal) => request<PolicyChoices>(`/choices/${kind}?${new URLSearchParams({search,page:String(page),pageSize:"25"})}`, { signal });
