"use client";

import { useState, useEffect, useCallback } from "react";
import { Payee } from "../types/payee.schema";

/**
 * Custom hook for managing payees data (Non-Trade)
 */
export function usePayees() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{
    hasError: boolean;
    message?: string;
  }>({
    hasError: false,
  });
  /**
   * Fetch payees from API
   */
  const fetchPayees = useCallback(async () => {
    try {
      setIsLoading(true);
      setError({ hasError: false });

      const response = await fetch("/api/fm/payee-registration/payees");

      if (!response.ok) {
        throw new Error("Failed to fetch payees");
      }

      const result = await response.json();
      setPayees(result.data || []);
    } catch (err: unknown) {
      setError({
        hasError: true,
        message: (err instanceof Error ? err.message : String(err)) || "Could not load payee records.",
      });
      setPayees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    void fetchPayees();
  }, [fetchPayees]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    void fetchPayees();
  }, [fetchPayees]);

  return {
    payees,
    isLoading,
    error,
    refresh,
  };
}
