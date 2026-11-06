"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fundApi } from "../providers/funds.api";
import { onboardingRequestId, OnboardingError } from "../providers/onboarding.api";
import type { FundDetails } from "../fund-types";

export function useFundRead<T>(path: string | null, delay = 0) {
  const [revision, setRevision] = useState(0), [result, setResult] = useState<{ path: string; key: string; data?: T; error?: Error } | null>(null);
  const key = JSON.stringify([path, revision]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { fundApi<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult({ path, key, data }); })
      .catch(cause => { if (!controller.signal.aborted) setResult(previous => ({ path, key, data: previous?.path === path ? previous.data : undefined, error: cause instanceof Error ? cause : new Error("Unable to load funds.") })); }); }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, key, delay]);
  const active = result?.path === path ? result : null, current = active?.key === key;
  return { data: active?.data, error: active?.error, loading: path !== null && !active, refreshing: path !== null && Boolean(active) && !current, refresh: useCallback(() => setRevision(value => value + 1), []) };
}
export function useFundDecision<T = FundDetails>() {
  const pending = useRef<{ key: string; path: string; payload: object } | null>(null), active = useRef(false);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState<Error | null>(null);
  async function completed() {
    if (!pending.current) return null;
    try {
      const status = await fundApi<{ state: string; result: { record?: T } }>(`requests/${pending.current.key}`);
      return status.state === "COMPLETED" ? status.result.record ?? null : null;
    } catch { return null; }
  }
  async function run(path: string, payload: object): Promise<T | null> {
    if (active.current) return null;
    active.current = true; setBusy(true); setError(null);
    try {
      if (!pending.current) pending.current = { key: onboardingRequestId(), path, payload };
      else {
        const previous = await completed();
        if (previous) { pending.current = null; setUncertain(false); return previous; }
      }
      const request = pending.current;
      const result = await fundApi<T>(request.path, { method: "POST", body: JSON.stringify({ ...request.payload, requestId: request.key }) });
      pending.current = null; setUncertain(false); return result;
    } catch (cause) {
      const previous = await completed();
      if (previous) { pending.current = null; setUncertain(false); return previous; }
      const failure = cause instanceof Error ? cause : new Error("Unable to complete the decision.");
      const unresolved = pending.current !== null && (!(failure instanceof OnboardingError) || failure.status >= 500);
      if (!unresolved) pending.current = null;
      setUncertain(unresolved); setError(failure); return null;
    } finally { active.current = false; setBusy(false); }
  }
  const clearError = useCallback(() => setError(null), []);
  return { run, busy, uncertain, error, clearError, retry: () => pending.current ? run(pending.current.path, pending.current.payload) : Promise.resolve(null) };
}
