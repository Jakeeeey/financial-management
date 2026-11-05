"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { voucherApi } from "../providers/vouchers.api";
import { onboardingRequestId } from "../providers/onboarding.api";
import type { VoucherInput, VoucherPreview } from "../voucher-types";

export function useVoucherRead<T>(path: string | null, delay = 0) {
  const [revision, setRevision] = useState(0), [result, setResult] = useState<{ key: string; data: T | null; error: Error | null } | null>(null);
  const key = JSON.stringify([path, revision]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { voucherApi<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult({ key, data, error: null }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause : new Error("Unable to load vouchers.") }); }); }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, key, delay]);
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : null, loading: path !== null && result?.key !== key, refresh: useCallback(() => setRevision(value => value + 1), []) };
}
export function useVoucherPreview(input: VoucherInput) {
  const serialized = JSON.stringify(input); const [revision, setRevision] = useState(0);
  const key = JSON.stringify([serialized, revision]);
  const [result, setResult] = useState<{ key: string; data: VoucherPreview | null; error: Error | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { voucherApi<VoucherPreview>("vouchers/preview", { method: "POST", body: serialized, signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult({ key, data, error: null }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause : new Error("Unable to preview calculations.") }); }); }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [serialized, key]);
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : null, loading: result?.key !== key, refresh: () => setRevision(value => value + 1) };
}
export function useVoucherCommand() {
  const active = useRef(false), identity = useRef<{ fingerprint: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null);
  async function run<T>(path: string, method: "POST" | "PUT", payload: object): Promise<T | null> {
    if (active.current) return null; active.current = true; setBusy(true); setError(null);
    try {
      const fingerprint = JSON.stringify([path, method, payload]);
      if (identity.current?.fingerprint !== fingerprint) identity.current = { fingerprint, key: onboardingRequestId() };
      const result = await voucherApi<T>(path, { method, body: JSON.stringify({ ...payload, requestId: identity.current.key }) }); identity.current = null; return result;
    } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to save voucher.")); return null; }
    finally { active.current = false; setBusy(false); }
  }
  return { run, busy, error };
}
