import { redirectToLogin } from "../utils/sessionExpiry";

export class OnboardingError extends Error {
  constructor(message: string, readonly status: number, readonly fields: Record<string, string> = {}, readonly requestId?: string, readonly code?: string) { super(message); }
}
export async function onboardingApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/fm/petty-cash/onboarding/${path}`, { ...init, cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 401) redirectToLogin();
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new OnboardingError(body?.message || "Unable to complete the Onboarding request.", response.status, body?.fieldErrors || {}, body?.requestId, body?.code);
  if (!body || typeof body !== "object") throw new OnboardingError("Onboarding returned incomplete information. Please retry.", 503);
  return body as T;
}
export function onboardingRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error("This browser cannot create a secure request identifier.");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16)); bytes[6] = bytes[6] & 15 | 64; bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
