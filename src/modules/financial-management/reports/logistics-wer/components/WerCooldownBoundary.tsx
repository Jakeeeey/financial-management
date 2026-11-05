"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { cooldownSnapshot, setWerScope, subscribeCooldown } from "../services/wer-requests";

export function useWerScope(scope: string) { useEffect(() => { setWerScope(scope); }, [scope]); }
export function WerCooldownBoundary({ children }: { children: ReactNode }) {
  const deadline = useSyncExternalStore(subscribeCooldown, cooldownSnapshot, () => 0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    if (deadline <= Date.now()) return;
    const timer = setInterval(() => {
      update();
      if (Date.now() >= deadline) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <>
    {seconds > 0 && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Too many requests. Please wait {seconds} seconds before trying again. Your entries have been kept.</div>}
    <fieldset disabled={seconds > 0} className="contents" onClickCapture={event => { if (seconds > 0) { event.preventDefault(); event.stopPropagation(); } }}>{children}</fieldset>
  </>;
}
