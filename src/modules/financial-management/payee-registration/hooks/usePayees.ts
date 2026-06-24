"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Fetch payees from API
   */
  const fetchPayees = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      setError({ hasError: false });

      const params = new URLSearchParams();
      if (search && search.trim() !== "") {
        params.set("search", search.trim());
      }

      const url = `/api/fm/payee-registration/payees${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

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
    fetchPayees(searchQuery);
  }, [fetchPayees, searchQuery]);

  /**
   * Search handler
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchPayees(query);
    },
    [fetchPayees],
  );

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchPayees();
  }, [fetchPayees]);

  /**
   * Memoized filtered payees
   */
  const filteredPayees = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      return payees;
    }

    const query = searchQuery.toLowerCase();
    return payees.filter(
      (payee) =>
        payee.supplier_name?.toLowerCase().includes(query) ||
        payee.tin_number?.toLowerCase().includes(query) ||
        payee.contact_person?.toLowerCase().includes(query),
    );
  }, [payees, searchQuery]);

  return {
    payees: filteredPayees,
    isLoading,
    error,
    refresh,
    searchQuery,
    setSearchQuery: handleSearch,
  };
}
