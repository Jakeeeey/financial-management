import { OnboardingError } from "./onboarding.api";
import { redirectToLogin } from "../utils/sessionExpiry";
export const VOUCHER_API = "/api/fm/petty-cash/disbursement";
export async function voucherApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VOUCHER_API}/${path}`, { ...init, cache: "no-store", headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 401) redirectToLogin();
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new OnboardingError(body?.message || "The voucher request failed. Please retry.", response.status, body?.fieldErrors || {}, body?.requestId);
  if (!body || typeof body !== "object") throw new OnboardingError("The voucher response was incomplete. Please retry.", 503);
  return body as T;
}
