"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FinancialReports } from "../report-types";
import { getFinancialReports } from "../providers/bankReconciliationReportsApi";

export function useFinancialReports(enabled: boolean) {
  const [data, setData] = useState<FinancialReports | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const selection = useRef<{ id: number; closureId?: number } | null>(null), request = useRef<AbortController | null>(null), generation = useRef(0);
  const invalidate = useCallback(() => { ++generation.current; request.current?.abort(); }, []);
  const load = useCallback(async (id: number, closureId?: number) => {
    const token = ++generation.current; request.current?.abort(); const controller = new AbortController(); request.current = controller;
    selection.current = { id, closureId }; setData(null); setLoading(true); setError("");
    try {
      const result = await getFinancialReports(id, closureId, controller.signal);
      if (token !== generation.current) return;
      setData(result); const url = new URL(window.location.href); url.searchParams.set("periodId", String(result.period.id));
      const revision = result.period.lifecycle?.closureId;
      if (revision) url.searchParams.set("closureId", String(revision)); else url.searchParams.delete("closureId");
      window.history.replaceState(null, "", url); selection.current = { id: result.period.id, closureId: revision };
    } catch (e) { if (!controller.signal.aborted && token === generation.current) setError(e instanceof Error ? e.message : "Unable to load financial reports."); }
    finally { if (token === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    function openUrl() {
      const params = new URLSearchParams(window.location.search), id = params.get("periodId"), closure = params.get("closureId");
      if (id == null && closure == null) { ++generation.current; request.current?.abort(); selection.current = null; setData(null); setLoading(false); setError(""); return; }
      if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || closure !== null && (!/^[1-9]\d*$/.test(closure) || !Number.isSafeInteger(Number(closure)))) { ++generation.current; request.current?.abort(); selection.current = null; setData(null); setLoading(false); setError("Choose a valid saved period and closure revision."); return; }
      if (selection.current?.id === Number(id) && selection.current.closureId === (closure ? Number(closure) : undefined)) return;
      void load(Number(id), closure ? Number(closure) : undefined);
    }
    openUrl(); window.addEventListener("popstate", openUrl);
    return () => { invalidate(); window.removeEventListener("popstate", openUrl); };
  }, [enabled, load, invalidate]);
  const refresh = useCallback(() => { if (selection.current) void load(selection.current.id, selection.current.closureId); }, [load]);
  return { data, loading, error, selectPeriod: load, refresh };
}
