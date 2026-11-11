"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryPage } from "../report-types";

export function useHistoryReport<T>(periodId: number, read: (id: number, page: number, through?: number, signal?: AbortSignal) => Promise<HistoryPage<T>>) {
  const [data, setData] = useState<HistoryPage<T> | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), generation = useRef(0), boundary = useRef<number | undefined>(undefined), targetPage = useRef(1);
  const cancel = useCallback(() => { ++generation.current; request.current?.abort(); }, []);
  const load = useCallback(async (page: number, reset = false) => {
    const token = ++generation.current; request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (reset) boundary.current = undefined;
    targetPage.current = page; setData(null); setLoading(true); setError("");
    try {
      const result = await read(periodId, page, boundary.current, controller.signal);
      if (token !== generation.current) return;
      boundary.current = result.throughEventId ?? result.throughClosureId; setData(result);
    } catch (e) { if (!controller.signal.aborted && token === generation.current) setError(e instanceof Error ? e.message : "Unable to load report history."); }
    finally { if (token === generation.current) setLoading(false); }
  }, [periodId, read]);
  useEffect(() => { void load(1, true); return cancel; }, [load, cancel]);
  return { data, loading, error, loadPage: (page: number) => void load(page), retry: () => void load(targetPage.current), refresh: () => void load(1, true) };
}
