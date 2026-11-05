"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getStockMovements,
  getStockPosition,
  getStockPositionChoices,
  StockPositionError,
} from "../providers/stock-position.api";
import type {
  PageResult,
  StockMovement,
  StockPositionChoice,
  StockPositionResponse,
} from "../stock-position-types";

export interface StockPositionFilters {
  agreementId: string;
  search: string;
  includeZero: boolean;
  page: number;
  pageSize: number;
}

export interface StockMovementFilters {
  agreementId: string;
  productId: string;
  inventoryClass: string;
  search: string;
  page: number;
  pageSize: number;
}

function positionQuery(filters: StockPositionFilters) {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    includeZero: String(filters.includeZero),
    search: filters.search,
  });
  if (filters.agreementId) query.set("agreementId", filters.agreementId);
  return query;
}

export function useStockPosition(filters: StockPositionFilters) {
  const [data, setData] = useState<StockPositionResponse | null>(null);
  const [agreements, setAgreements] = useState<StockPositionChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<StockPositionError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockPosition(positionQuery(filters)));
    } catch (cause) {
      setError(cause instanceof StockPositionError ? cause : new StockPositionError("Unable to load stock position.", 503));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getStockPositionChoices("agreements", new URLSearchParams({ page: "1", pageSize: "100" }), controller.signal)
      .then(result => { if (active) setAgreements(result.items); })
      .catch(() => { if (active) setAgreements([]); })
      .finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  return { data, agreements, loading, optionsLoading, error, refresh };
}

export function useStockMovements(filters: StockMovementFilters, enabled: boolean) {
  const [data, setData] = useState<PageResult<StockMovement> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StockPositionError | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
        search: filters.search,
      });
      if (filters.agreementId) query.set("agreementId", filters.agreementId);
      if (filters.productId) query.set("productId", filters.productId);
      if (filters.inventoryClass) query.set("inventoryClass", filters.inventoryClass);
      setData(await getStockMovements(query));
    } catch (cause) {
      setError(cause instanceof StockPositionError ? cause : new StockPositionError("Unable to load movement history.", 503));
    } finally {
      setLoading(false);
    }
  }, [enabled, filters]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
