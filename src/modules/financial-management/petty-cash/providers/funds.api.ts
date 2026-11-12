import { OnboardingError } from "./onboarding.api";
import { redirectToLogin } from "../utils/sessionExpiry";
export async function fundApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/fm/petty-cash/${path}`, { ...init, cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 401) redirectToLogin();
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new OnboardingError(data?.message || "Unable to complete the fund request.", response.status, data?.fieldErrors || {}, data?.requestId, data?.code);
  if (!data || typeof data !== "object") throw new OnboardingError("The fund response was incomplete. Check request status before retrying.", 503);
  return data as T;
}
