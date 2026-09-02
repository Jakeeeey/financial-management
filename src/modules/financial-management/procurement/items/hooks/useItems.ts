"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { listItems } from "@/modules/financial-management/procurement/items/providers/itemService";
import type { ItemTemplate } from "@/modules/financial-management/procurement/items/utils/types";

interface UseItemsOptions {
  search?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

interface UseItemsResult {
  data: ItemTemplate[];
  loading: boolean;
  error: string | null;
  total: number;
  reload: () => void;
}

export function useItems(opts?: UseItemsOptions): UseItemsResult {
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

    listItems(
      { search: opts?.search, page: opts?.page, limit: opts?.limit, activeOnly: opts?.activeOnly },
      ac.signal
    )
      .then((res) => {
        if (!ac.signal.aborted) {
          setData(res.data || []);
          setTotal(res.total ?? (res.data || []).length);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load items");
          setLoading(false);
        }
      });

    return () => ac.abort();
  }, [opts?.search, opts?.page, opts?.limit, opts?.activeOnly, reloadKey]);

  return { data, loading, error, total, reload };
}
