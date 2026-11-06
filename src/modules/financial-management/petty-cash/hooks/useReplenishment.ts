"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { replenishmentApi, recoverReplenishmentRequest } from "../providers/replenishment.api";
import { onboardingRequestId, OnboardingError } from "../providers/onboarding.api";
export function useReplenishmentRead<T>(path: string | null, delay = 0) {
  const [revision, setRevision] = useState(0), [result, setResult] = useState<{ path: string; key: string; data: T | null; error: Error | null } | null>(null);
  const key = JSON.stringify([path, revision]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { replenishmentApi<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult({ path, key, data, error: null }); })
      .catch(cause => { if (!controller.signal.aborted) setResult(previous => ({ path, key, data: previous?.path === path ? previous.data : null, error: cause instanceof Error ? cause : new Error("Unable to load replenishment.") })); }); }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, key, delay]);
  const active = result?.path === path ? result : null, current = active?.key === key;
  return { data: active?.data ?? null, error: active?.error ?? null, loading: path !== null && !active, refreshing: path !== null && Boolean(active) && !current, refresh: useCallback(() => setRevision(value => value + 1), []) };
}
export function useReplenishmentCommand() {
  const active = useRef(false), identity = useRef<{ fingerprint: string; key: string } | null>(null);
  const lastCall = useRef<{ path: string; method: "POST" | "PUT"; payload: object } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null);
  const run = useCallback(async <T,>(path: string, method: "POST" | "PUT", payload: object): Promise<T | null> => {
    if (active.current) return null;
    active.current = true; setBusy(true); setError(null);
    lastCall.current = { path, method, payload };
    try {
      const fingerprint = JSON.stringify([path, method, payload]);
      if (identity.current && identity.current.fingerprint !== fingerprint) {
        const previous = await recoverReplenishmentRequest(identity.current.key);
        if (previous && previous.state !== "COMPLETED") throw new Error("The previous request is still in progress. Retry after it completes.");
        identity.current = null;
      }
      identity.current ??= { fingerprint, key: onboardingRequestId() };
      let result: T;
      try { result = await replenishmentApi<T>(path, { method, body: JSON.stringify({ ...payload, requestId: identity.current.key }) }); }
      catch (cause) {
        if (cause instanceof OnboardingError && cause.status < 500) throw cause;
        const recovered = await recoverReplenishmentRequest(identity.current.key);
        if (recovered?.state !== "COMPLETED" || !recovered.result.record) throw cause;
        result = recovered.result.record as T;
      }
      identity.current = null; return result;
    } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to save replenishment.")); return null; }
    finally { active.current = false; setBusy(false); }
  }, []);
  const retry = useCallback(() => lastCall.current ? run(lastCall.current.path, lastCall.current.method, lastCall.current.payload) : Promise.resolve(null), [run]);
  const clearError = useCallback(() => setError(null), []);
  return { run, retry, clearError, busy, error };
}
