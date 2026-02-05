"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllDiscountTypes } from "../services/discount-types";
import { DiscountType } from "../types/discount-type.schema";

/**
 * Custom hook for managing discount types
 */
export function useDiscountTypes() {
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch discount types from API
   */
  const fetchDiscountTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchAllDiscountTypes();
      setDiscountTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setDiscountTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchDiscountTypes();
  }, [fetchDiscountTypes]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    fetchDiscountTypes();
  }, [fetchDiscountTypes]);

  return {
    discountTypes,
    isLoading,
    error,
    refresh,
  };
}
