import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { customerDiscountingApi } from "../providers/customerDiscountingApi";
import type {
  CustomerDiscountingCustomer,
  CustomerDiscountingModuleData,
  CustomerDiscountingRules,
} from "../types";

const emptyRules: CustomerDiscountingRules = {
  supplierCategoryRules: [],
  productRules: [],
};

export function useCustomerDiscounting(userId: number | null) {
  const [moduleData, setModuleData] = useState<CustomerDiscountingModuleData | null>(null);
  const [rules, setRules] = useState<CustomerDiscountingRules>(emptyRules);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDiscountingCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModuleData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customerDiscountingApi.getModuleData();
      setModuleData(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load customer discounting data";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRules = useCallback(async (customerCode: string) => {
    try {
      setRulesLoading(true);
      setRules(await customerDiscountingApi.getRules(customerCode));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load customer discounting rules";
      toast.error(message);
      setRules(emptyRules);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const selectCustomer = useCallback((customer: CustomerDiscountingCustomer) => {
    setSelectedCustomer(customer);
    void loadRules(customer.customerCode);
  }, [loadRules]);

  const refreshSelectedCustomer = useCallback(async () => {
    if (!selectedCustomer) return;
    await Promise.all([loadModuleData(), loadRules(selectedCustomer.customerCode)]);
  }, [loadModuleData, loadRules, selectedCustomer]);

  const updateGlobalDiscount = useCallback(async (discountTypeId: number | null) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      await customerDiscountingApi.updateGlobalDiscount({
        customerCode: selectedCustomer.customerCode,
        customerId: selectedCustomer.id,
        discountTypeId,
        updatedBy: userId,
      });
      toast.success("Global customer discount updated");
      await loadModuleData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update global customer discount");
    } finally {
      setSaving(false);
    }
  }, [loadModuleData, selectedCustomer, userId]);

  const addSupplierCategoryRule = useCallback(async (payload: {
    supplierId: number;
    categoryId: number;
    discountTypeId: number;
  }) => {
    if (!selectedCustomer) return false;
    try {
      setSaving(true);
      await customerDiscountingApi.addSupplierCategoryRule({
        customerCode: selectedCustomer.customerCode,
        ...payload,
        createdBy: userId,
      });
      toast.success("Supplier/category discount added");
      await loadRules(selectedCustomer.customerCode);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add supplier/category discount");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  const addProductRule = useCallback(async (payload: {
    productId: number;
    discountTypeId: number | null;
    unitPrice: number | null;
  }) => {
    if (!selectedCustomer) return false;
    try {
      setSaving(true);
      await customerDiscountingApi.addProductRule({
        customerCode: selectedCustomer.customerCode,
        ...payload,
        createdBy: userId,
      });
      toast.success("Product discount added");
      await loadRules(selectedCustomer.customerCode);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add product discount");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  const deleteSupplierCategoryRule = useCallback(async (id: number) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      await customerDiscountingApi.deleteSupplierCategoryRule(id, userId);
      toast.success("Supplier/category discount removed");
      await loadRules(selectedCustomer.customerCode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete supplier/category discount");
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  const deleteProductRule = useCallback(async (id: number) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      await customerDiscountingApi.deleteProductRule(id, userId);
      toast.success("Product discount removed");
      await loadRules(selectedCustomer.customerCode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product discount");
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  useEffect(() => {
    void loadModuleData();
  }, [loadModuleData]);

  return {
    moduleData,
    rules,
    selectedCustomer,
    setSelectedCustomer,
    selectCustomer,
    loading,
    rulesLoading,
    saving,
    error,
    refreshSelectedCustomer,
    updateGlobalDiscount,
    addSupplierCategoryRule,
    addProductRule,
    deleteSupplierCategoryRule,
    deleteProductRule,
  };
}
