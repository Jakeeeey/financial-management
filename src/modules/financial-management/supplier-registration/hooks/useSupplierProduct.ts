"use client";

import { useState, useEffect, useCallback } from "react";

import { toast } from "sonner";
import {
  fetchSupplierProducts,
  addProductToSupplier,
  updateProductDiscount,
  removeProductFromSupplier,
  isProductAlreadyAdded,
} from "../services/products-per-suppliers";
import { ProductPerSupplierWithDetails } from "../types/product-per-suppplier.schema";

/**
 * Custom hook for managing products assigned to a supplier
 */
export function useSupplierProducts(supplierId: number | null) {
  const [products, setProducts] = useState<ProductPerSupplierWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch products for supplier
   */
  const fetchProducts = useCallback(async (id: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchSupplierProducts(id);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Add product to supplier
   */
  const addProduct = useCallback(
    async (productId: number, discountType: number | null = null) => {
      if (!supplierId) {
        toast.error("Supplier ID is required");
        return false;
      }

      try {
        // Check if product already exists
        const exists = await isProductAlreadyAdded(supplierId, productId);
        if (exists) {
          toast.error("This product is already assigned to this supplier");
          return false;
        }

        await addProductToSupplier({
          supplier_id: supplierId,
          product_id: productId,
          discount_type: discountType,
        });

        toast.success("Product added successfully");
        await fetchProducts(supplierId);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg);
        return false;
      }
    },
    [supplierId, fetchProducts],
  );

  /**
   * Update discount type for product
   */
  const updateDiscount = useCallback(
    async (productPerSupplierId: number, discountType: number | null) => {
      if (!supplierId) {
        toast.error("Supplier ID is required");
        return false;
      }

      try {
        await updateProductDiscount(productPerSupplierId, discountType);
        toast.success("Discount type updated");
        await fetchProducts(supplierId);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg);
        return false;
      }
    },
    [supplierId, fetchProducts],
  );

  /**
   * Remove product from supplier
   */
  const removeProduct = useCallback(
    async (productPerSupplierId: number) => {
      if (!supplierId) {
        toast.error("Supplier ID is required");
        return false;
      }

      try {
        await removeProductFromSupplier(productPerSupplierId);
        toast.success("Product removed successfully");
        await fetchProducts(supplierId);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg);
        return false;
      }
    },
    [supplierId, fetchProducts],
  );

  /**
   * Fetch products when supplierId changes
   */
  useEffect(() => {
    if (supplierId) {
      fetchProducts(supplierId);
    } else {
      setProducts([]);
      setError(null);
    }
  }, [supplierId, fetchProducts]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    if (supplierId) {
      fetchProducts(supplierId);
    }
  }, [supplierId, fetchProducts]);

  return {
    products,
    isLoading,
    error,
    addProduct,
    updateDiscount,
    removeProduct,
    refresh,
  };
}
