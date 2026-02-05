"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllProducts, searchProducts } from "../services/products";
import { Product } from "../types/product.schema";

/**
 * Custom hook for managing products list
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Fetch products from API
   */
  const fetchProducts = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      let data;
      if (search && search.trim() !== "") {
        data = await searchProducts(search.trim());
      } else {
        data = await fetchAllProducts();
      }

      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Search handler
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchProducts(query);
    },
    [fetchProducts],
  );

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    fetchProducts(searchQuery);
  }, [fetchProducts, searchQuery]);

  return {
    products,
    isLoading,
    error,
    refresh,
    searchQuery,
    setSearchQuery: handleSearch,
  };
}
