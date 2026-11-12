import { OnboardingError } from "./onboarding.api";
import { redirectToLogin } from "../utils/sessionExpiry";
export const REPLENISHMENT_API = "/api/fm/petty-cash/replenishment";
export async function replenishmentApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${REPLENISHMENT_API}/${path}`, { ...init, cache: "no-store", headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 401) redirectToLogin();
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new OnboardingError(body?.message || "The replenishment request failed. Please retry.", response.status, body?.fieldErrors || {}, body?.requestId, body?.code);
  if (!body || typeof body !== "object") throw new OnboardingError("The replenishment response was incomplete. Please retry.", 503);
  return body as T;
}
export async function recoverReplenishmentRequest(key: string): Promise<{ state: string; result: { record?: unknown } } | null> {
  const response = await fetch(`/api/fm/petty-cash/requests/${key}`, { cache: "no-store" });
  if (response.status === 401) redirectToLogin();
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to confirm the previous request. Retry the same action before making another change.");
  return response.json();
}
