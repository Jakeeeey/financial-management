"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { listTemplates } from "../providers/item-template-service";
import type { ItemTemplate } from "../utils/types";

interface UseTemplatesOptions {
  search?: string;
  page?: number;
  limit?: number;
}

interface UseTemplatesResult {
  data: ItemTemplate[];
  loading: boolean;
  error: string | null;
  total: number;
  reload: () => void;
}

export function useTemplates(opts?: UseTemplatesOptions): UseTemplatesResult {
  const [data, setData] = useState<ItemTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    listTemplates({ search: opts?.search, page: opts?.page, limit: opts?.limit }, ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) {
          setData(res.data || []);
          setTotal(res.total ?? (res.data || []).length);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load templates");
          setLoading(false);
        }
      });

    return () => ac.abort();
  }, [opts?.search, opts?.page, opts?.limit, reloadKey]);

  return { data, loading, error, total, reload };
}
