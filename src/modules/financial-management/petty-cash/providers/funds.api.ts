import { OnboardingError } from "./onboarding.api";
export async function fundApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/fm/petty-cash/${path}`, { ...init, cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new OnboardingError(data?.message || "Unable to complete the fund request.", response.status, data?.fieldErrors || {}, data?.requestId);
  if (!data || typeof data !== "object") throw new OnboardingError("The fund response was incomplete. Check request status before retrying.", 503);
  return data as T;
}
