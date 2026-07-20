"use client";

import { useState, useEffect, useRef } from "react";
import { listVariants } from "../providers/item-variant-service";
import type { ItemVariant } from "../utils/types";

interface UseVariantsOptions {
  search?: string;
  page?: number;
  limit?: number;
}

interface UseVariantsResult {
  data: ItemVariant[];
  loading: boolean;
  error: string | null;
  total: number;
  reload: () => void;
}

export function useVariants(opts?: UseVariantsOptions): UseVariantsResult {
  const [data, setData] = useState<ItemVariant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    listVariants({ search: opts?.search, page: opts?.page, limit: opts?.limit }, ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) {
          setData(res.data || []);
          setTotal(res.total ?? (res.data || []).length);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load variants");
          setLoading(false);
        }
      });

    return () => ac.abort();
  }, [opts?.search, opts?.page, opts?.limit, reloadKey]);

  return { data, loading, error, total, reload: () => setReloadKey((k) => k + 1) };
}
