"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPayeeProducts } from "../services/products-per-payee";
import { toast } from "sonner";

export function usePayeeProducts(payeeId: number | null) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!payeeId) return;
    setIsLoading(true);
    try {
      const data = await fetchPayeeProducts(payeeId);
      // Map nested data for easier UI access
      const mappedData = data.map((item: any) => ({
        id: item.id,
        product_id:
          typeof item.product_id === "object" && item.product_id !== null
            ? (item.product_id as { product_id?: number; id?: number }).product_id ||
              (item.product_id as { product_id?: number; id?: number }).id
            : item.product_id,
        product_name: item.product_id?.product_name || "Unknown Product",
        product_code: item.product_id?.product_code || "N/A",
        discount_type: item.discount_type_id?.name || "None",
        discount_type_id: item.discount_type_id?.id || item.discount_type_id,
      }));
      setProducts(mappedData);
    } catch (error) {
      toast.error("Failed to load assigned products");
    } finally {
      setIsLoading(false);
    }
  }, [payeeId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const addProductsBulk = async (productIds: number[]) => {
    if (!payeeId) return;
    try {
      const response = await fetch(`/api/payee-registration/payees/${payeeId}/products/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to add products");
      await loadProducts();
      toast.success("Products added successfully");
    } catch (error) {
      toast.error("Failed to add products");
    }
  };

  const updateDiscount = async (assignmentId: number, discountTypeId: string | number | null) => {
    try {
      const response = await fetch(`/api/payee-registration/payees/products/${assignmentId}/discount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountTypeId }),
      });
      if (!response.ok) throw new Error("Failed to update discount");
      await loadProducts();
      toast.success("Discount updated");
    } catch (error) {
      toast.error("Failed to update discount");
    }
  };

  const removeProduct = async (assignmentId: number) => {
    try {
      const response = await fetch(`/api/payee-registration/payees/products/${assignmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove product");
      await loadProducts();
      toast.success("Product removed");
    } catch (error) {
      toast.error("Failed to remove product");
    }
  };

  return {
    products,
    isLoading,
    refresh: loadProducts,
    addProductsBulk,
    updateDiscount,
    removeProduct,
  };
}
