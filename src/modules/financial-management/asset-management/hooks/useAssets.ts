"use client";

import { useState, useEffect, useCallback } from "react";
import { AssetTableData } from "../types";
import { toast } from "sonner";

export function useAssets() {
  const [assets, setAssets] = useState<AssetTableData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{
    hasError: boolean;
    message?: string;
  }>({
    hasError: false,
  });

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError({ hasError: false });

      const response = await fetch("/api/fm/asset-management");
      if (!response.ok) throw new Error("Failed to fetch data from server");

      const result = await response.json();

      if (!Array.isArray(result))
        throw new Error("Invalid data format received");

      setAssets(result);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Could not load asset records.";
      setError({
        hasError: true,
        message,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const refresh = useCallback(() => {
    fetchAssets();
  }, [fetchAssets]);

  return {
    assets,
    isLoading,
    error,
    refresh,
  };
}
