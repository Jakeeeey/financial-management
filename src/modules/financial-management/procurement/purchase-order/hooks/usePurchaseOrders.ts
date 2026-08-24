"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { listPOs, getPOById } from "../providers/purchase-order-service";
import type { PurchaseOrder, PurchaseOrderItem } from "../utils/types";

interface POListState {
  data: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  total: number;
}

export function usePOList(params?: { search?: string; status?: string }) {
  const [state, setState] = useState<POListState>({ data: [], loading: true, error: null, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await listPOs({
        search: params?.search,
        status: params?.status,
        limit: 300,
      }, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data: result.data ?? [], loading: false, error: null, total: result.total ?? 0 });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setState((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Unknown error" }));
      }
    }
  }, [params?.search, params?.status]);

  useEffect(() => {
    fetch();
    return () => abortRef.current?.abort();
  }, [fetch]);

  return { ...state, refetch: fetch };
}

export function usePODetail(id: number) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [received, setReceived] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPOById(id);
      setPo(result.data.po);
      setItems(result.data.items);
      setReceived(result.data.received ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { po, items, received, loading, error, refetch: fetch };
}
