// src/modules/financial-management/accounting/discount-management/supplier-discounting/hooks/useSupplierDiscounting.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supplierDiscountingApi } from "../providers/supplierDiscountingApi";
import type {
  SupplierDiscountBulkResult,
  SupplierDiscountModuleData,
  SupplierDiscountProductPage,
  SupplierDiscountRule,
  SupplierDiscountSupplier,
} from "../types";

const emptyProductPage: SupplierDiscountProductPage = {
  products: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    search: "",
  },
  emptyStateMessage: null,
};

/**
 * Formats failed bulk rows so the toast identifies the exact products that failed.
 */
function failedRuleDescription(failed: SupplierDiscountBulkResult["failed"], savedCount: number) {
  const rows = failed
    .map((item) => `${item.productName}: ${item.reason}`)
    .join("\n");
  const saved = savedCount > 0 ? `${savedCount} rule(s) saved.\n` : "";
  return `${saved}${rows}`;
}

/**
 * Coordinates supplier selection, product loading, and bulk discount mutations.
 */
export function useSupplierDiscounting(initialModuleData: SupplierDiscountModuleData) {
  const [moduleData] = useState<SupplierDiscountModuleData>(initialModuleData);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDiscountSupplier | null>(null);
  const [rules, setRules] = useState<SupplierDiscountRule[]>([]);
  const [productPage, setProductPage] = useState<SupplierDiscountProductPage>(emptyProductPage);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(false);
  const loadSeqRef = useRef(0);
  const rulesSeqRef = useRef(0);

  /**
   * Loads parent products that match the current assignment filters.
   */
  const loadProducts = useCallback(async (query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: number | null;
    brandId?: number | null;
  }) => {
    const seq = ++loadSeqRef.current;
    try {
      setProductsLoading(true);
      const result = await supplierDiscountingApi.getProducts(query);
      if (seq !== loadSeqRef.current) return;
      setProductPage(result);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load parent products");
      setProductPage(emptyProductPage);
    } finally {
      if (seq === loadSeqRef.current) setProductsLoading(false);
    }
  }, []);

  /**
   * Loads discount rules for the currently selected supplier.
   */
  const loadRules = useCallback(async (supplierId: number, includeChildrenOverride?: boolean) => {
    const seq = ++rulesSeqRef.current;
    const shouldIncludeChildren = includeChildrenOverride ?? includeChildren;
    try {
      setRulesLoading(true);
      const result = await supplierDiscountingApi.getRules(supplierId, shouldIncludeChildren);
      if (seq !== rulesSeqRef.current) return;
      setRules(result);
    } catch (err) {
      if (seq !== rulesSeqRef.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load supplier discount rules");
      setRules([]);
    } finally {
      if (seq === rulesSeqRef.current) setRulesLoading(false);
    }
  }, [includeChildren]);

  /**
   * Updates supplier selection and refreshes that supplier's rules.
   */
  const selectSupplier = useCallback((supplierId: number | null) => {
    const supplier = moduleData.suppliers.find((item) => item.id === supplierId) ?? null;
    setSelectedSupplier(supplier);
    setSelectedProductIds([]);

    if (supplier) {
      void loadRules(supplier.id);
    } else {
      setRules([]);
    }
  }, [loadRules, moduleData.suppliers]);

  /**
   * Toggles a product in the bulk assignment selection.
   */
  const toggleProduct = useCallback((productId: number, checked: boolean) => {
    setSelectedProductIds((current) => {
      if (checked) return Array.from(new Set([...current, productId]));
      return current.filter((item) => item !== productId);
    });
  }, []);

  /**
   * Applies the selected discount to every selected product, creating or updating rules as needed.
   */
  const applyBulkDiscount = useCallback(async (discountTypeId: number | null) => {
    if (!selectedSupplier) {
      toast.error("Select a supplier first");
      return false;
    }

    if (!discountTypeId) {
      toast.error("Select a discount first");
      return false;
    }

    if (selectedProductIds.length === 0) {
      toast.error("Select at least one parent product");
      return false;
    }

    try {
      setSaving(true);
      const preflight = await supplierDiscountingApi.preflightRules({
        supplierId: selectedSupplier.id,
        productIds: selectedProductIds,
      });
      const result = await supplierDiscountingApi.bulkApplyRules({
        supplierId: selectedSupplier.id,
        discountTypeId,
        newLinks: preflight.newLinks,
        existingLinks: preflight.existingLinks,
      });

      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} product discount rule(s) failed to save`, {
          description: failedRuleDescription(result.failed, result.created + result.updated),
        });
        setSelectedProductIds(result.failed.map((item) => item.productId));
      } else {
        toast.success(`Applied ${result.created + result.updated} supplier discount rule(s)`);
        setSelectedProductIds([]);
      }

      await loadRules(selectedSupplier.id);
      return result.failed.length === 0;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply supplier discounts");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedProductIds, selectedSupplier]);

  /**
   * Deletes an existing supplier discount rule and refreshes the rule list.
   */
  const deleteRule = useCallback(async (id: number) => {
    if (!selectedSupplier) return;

    try {
      setSaving(true);
      await supplierDiscountingApi.deleteRule(id, selectedSupplier.id);
      toast.success("Supplier discount rule removed");
      await loadRules(selectedSupplier.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete supplier discount rule");
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedSupplier]);

  return {
    moduleData,
    selectedSupplier,
    rules,
    productPage,
    selectedProductIds,
    productsLoading,
    rulesLoading,
    saving,
    includeChildren,
    setIncludeChildren,
    loadProducts,
    loadRules,
    selectSupplier,
    toggleProduct,
    setSelectedProductIds,
    applyBulkDiscount,
    deleteRule,
  };
}
