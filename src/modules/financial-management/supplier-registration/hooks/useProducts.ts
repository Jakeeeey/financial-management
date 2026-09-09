"use client";

import { useState, useEffect, useCallback } from "react";
import { Product } from "../types/product.schema";

const PAGE_SIZE = 50;

/**
 * Custom hook for managing products list with pagination and infinite scroll
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<{
    hasError: boolean;
    message?: string;
  }>({
    hasError: false,
  });

  /**
   * Fetch products from API (paginated)
   */
  const fetchProducts = useCallback(async (search?: string, initial = true) => {
    try {
      if (initial) {
        setIsLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setIsFetchingMore(true);
      }
      setError({ hasError: false, message: "" });

      // Calculate next offset
      const currentOffset = initial ? 0 : offset + PAGE_SIZE;

      const url = new URL(
        "/api/fm/supplier-registration/products",
        window.location.origin,
      );
      url.searchParams.append("limit", String(PAGE_SIZE));
      url.searchParams.append("offset", String(currentOffset));
      if (search) url.searchParams.append("search", search);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const result = await response.json();
      const newProducts = result.data || [];

      if (initial) {
        setProducts(newProducts);
      } else {
        setProducts((prev) => [...prev, ...newProducts]);
        setOffset(currentOffset);
      }

      // If we received fewer items than PAGE_SIZE, we reached the end
      if (newProducts.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err: unknown) {
      setError({
        hasError: true,
        message: err instanceof Error ? err.message : String(err),
      });
      if (initial) {
        setProducts([]);
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [offset]);

  /**
   * Load more products for infinite scroll
   */
  const loadMore = useCallback(async () => {
    if (isLoading || isFetchingMore || !hasMore) return;
    await fetchProducts(searchQuery, false);
  }, [isLoading, isFetchingMore, hasMore, searchQuery, fetchProducts]);

  /**
   * Search handler
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchProducts(query, true);
    },
    [fetchProducts],
  );

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchProducts("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    fetchProducts(searchQuery, true);
  }, [fetchProducts, searchQuery]);

  return {
    products,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    searchQuery,
    setSearchQuery: handleSearch,
  };
}
