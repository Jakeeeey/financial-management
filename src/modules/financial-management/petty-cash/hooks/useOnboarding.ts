"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onboardingApi, onboardingRequestId, OnboardingError } from "../providers/onboarding.api";

export function useOnboardingRead<T>(path: string, delay = 0) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; error: Error | null } | null>(null);
  const key = JSON.stringify([path, revision]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      onboardingApi<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult({ key, data, error: null }); })
        .catch(cause => { if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause : new Error("Unable to load Onboarding.") }); });
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [path, key, delay]);
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : null,
    loading: result?.key !== key, refresh: useCallback(() => setRevision(value => value + 1), []) };
}
export function useOnboardingCommand() {
  const active = useRef(false); const identity = useRef<{ fingerprint: string; key: string } | null>(null);
  const failure = useRef<Error | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<Error | null>(null);
  async function run<T>(path: string, method: "POST" | "PUT" | "PATCH", payload: object): Promise<T | null> {
    if (active.current) return null; active.current = true; failure.current = null; setBusy(true); setError(null);
    try {
      const fingerprint = JSON.stringify([path, method, payload]);
      if (identity.current?.fingerprint !== fingerprint) identity.current = { fingerprint, key: onboardingRequestId() };
      const data = await onboardingApi<T>(path, { method, body: JSON.stringify({ ...payload, requestId: identity.current.key }) });
      identity.current = null; return data;
    } catch (cause) { failure.current = cause instanceof Error ? cause : new OnboardingError("Unable to save Onboarding.", 503); setError(failure.current); return null; }
    finally { active.current = false; setBusy(false); }
  }
  return { run, busy, error, failure };
}
