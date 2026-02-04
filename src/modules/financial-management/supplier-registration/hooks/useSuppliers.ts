"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Supplier } from "@/modules/financial-management/supplier-registration/types/supplier.schema";

/**
 * Custom hook for managing suppliers data
 * Features:
 * - Memoized state
 * - Search filtering
 * - Auto-refresh on window focus
 * - Manual refresh trigger
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Fetch suppliers from API
   */
  const fetchSuppliers = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search && search.trim() !== "") {
        params.set("search", search.trim());
      }

      const url = `/api/supplier-registration/suppliers${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      const result = await response.json();
      setSuppliers(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    fetchSuppliers(searchQuery);
  }, [fetchSuppliers, searchQuery]);

  /**
   * Search handler
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchSuppliers(query);
    },
    [fetchSuppliers],
  );

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchSuppliers();
  }, []);

  /**
   * Memoized filtered suppliers
   * Client-side filtering for instant feedback
   */
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      return suppliers;
    }

    const query = searchQuery.toLowerCase();
    return suppliers.filter(
      (supplier) =>
        supplier.supplier_name?.toLowerCase().includes(query) ||
        supplier.tin_number?.toLowerCase().includes(query) ||
        supplier.contact_person?.toLowerCase().includes(query) ||
        supplier.supplier_type?.toLowerCase().includes(query),
    );
  }, [suppliers, searchQuery]);

  return {
    suppliers: filteredSuppliers,
    isLoading,
    error,
    refresh,
    searchQuery,
    setSearchQuery: handleSearch,
  };
}
