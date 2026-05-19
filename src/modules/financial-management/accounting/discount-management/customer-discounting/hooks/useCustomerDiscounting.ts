// src/modules/financial-management/accounting/discount-management/customer-discounting/hooks/useCustomerDiscounting.ts
import { useCallback, useRef, useState } from "react";
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

/**
 * Coordinates customer selection, rule loading, and rule mutations for the module.
 */
export function useCustomerDiscounting(userId: number | null, initialModuleData: CustomerDiscountingModuleData) {
  const [moduleData, setModuleData] = useState<CustomerDiscountingModuleData>(initialModuleData);
  const [rules, setRules] = useState<CustomerDiscountingRules>(emptyRules);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDiscountingCustomer | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const rulesSeqRef = useRef(0);
  const selectedCustomerCodeRef = useRef<string | null>(null);

  /**
   * Loads the supplier/category and product rules for a selected customer code.
   */
  const loadRules = useCallback(async (customerCode: string) => {
    const seq = ++rulesSeqRef.current;
    try {
      setRulesLoading(true);
      const nextRules = await customerDiscountingApi.getRules(customerCode);
      if (seq === rulesSeqRef.current && selectedCustomerCodeRef.current === customerCode) {
        setRules(nextRules);
      }
    } catch (err) {
      if (seq !== rulesSeqRef.current || selectedCustomerCodeRef.current !== customerCode) return;
      const message = err instanceof Error ? err.message : "Failed to load customer discounting rules";
      toast.error(message);
      setRules(emptyRules);
    } finally {
      if (seq === rulesSeqRef.current && selectedCustomerCodeRef.current === customerCode) {
        setRulesLoading(false);
      }
    }
  }, []);

  /**
   * Selects a customer and eagerly loads its rules for the configuration sheet.
   */
  const selectCustomer = useCallback((customer: CustomerDiscountingCustomer) => {
    selectedCustomerCodeRef.current = customer.customerCode;
    setSelectedCustomer(customer);
    setRules(emptyRules);
    void loadRules(customer.customerCode);
  }, [loadRules]);

  const refreshSelectedCustomer = useCallback(async () => {
    if (!selectedCustomer) return;
    await loadRules(selectedCustomer.customerCode);
  }, [loadRules, selectedCustomer]);

  /**
   * Saves the customer's global discount and mirrors the change in local table state.
   */
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
      const globalDiscount = discountTypeId
        ? moduleData.discountTypes.find((item) => item.id === discountTypeId) ?? null
        : null;
      setModuleData((current) => ({
        ...current,
        customers: current.customers.map((customer) =>
          customer.customerCode === selectedCustomer.customerCode
            ? { ...customer, globalDiscount }
            : customer,
        ),
      }));
      setSelectedCustomer((current) =>
        current?.customerCode === selectedCustomer.customerCode
          ? { ...current, globalDiscount }
          : current,
      );
      toast.success("Global customer discount updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update global customer discount");
    } finally {
      setSaving(false);
    }
  }, [moduleData.discountTypes, selectedCustomer, userId]);

  /**
   * Creates a supplier/category rule and refreshes the selected customer's rules.
   */
  const addSupplierCategoryRule = useCallback(async (payload: {
    supplierId: number;
    categoryId: number;
    discountTypeId: number;
  }) => {
    if (!selectedCustomer) return false;
    try {
      setSaving(true);
      const customerCode = selectedCustomer.customerCode;
      await customerDiscountingApi.addSupplierCategoryRule({
        customerCode,
        ...payload,
        createdBy: userId,
      });
      toast.success("Supplier/category discount added");
      if (selectedCustomerCodeRef.current === customerCode) await loadRules(customerCode);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add supplier/category discount");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  /**
   * Creates a product-specific rule and refreshes the selected customer's rules.
   */
  const addProductRule = useCallback(async (payload: {
    productId: number;
    discountTypeId: number | null;
    unitPrice: number | null;
  }) => {
    if (!selectedCustomer) return false;
    try {
      setSaving(true);
      const customerCode = selectedCustomer.customerCode;
      await customerDiscountingApi.addProductRule({
        customerCode,
        ...payload,
        createdBy: userId,
      });
      toast.success("Product discount added");
      if (selectedCustomerCodeRef.current === customerCode) await loadRules(customerCode);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add product discount");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  /**
   * Soft-deletes a supplier/category rule through the BFF.
   */
  const deleteSupplierCategoryRule = useCallback(async (id: number) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      const customerCode = selectedCustomer.customerCode;
      await customerDiscountingApi.deleteSupplierCategoryRule(id, customerCode, userId);
      toast.success("Supplier/category discount removed");
      if (selectedCustomerCodeRef.current === customerCode) await loadRules(customerCode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete supplier/category discount");
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  /**
   * Soft-deletes a product-specific rule through the BFF.
   */
  const deleteProductRule = useCallback(async (id: number) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      const customerCode = selectedCustomer.customerCode;
      await customerDiscountingApi.deleteProductRule(id, customerCode, userId);
      toast.success("Product discount removed");
      if (selectedCustomerCodeRef.current === customerCode) await loadRules(customerCode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product discount");
    } finally {
      setSaving(false);
    }
  }, [loadRules, selectedCustomer, userId]);

  return {
    moduleData,
    rules,
    selectedCustomer,
    setSelectedCustomer,
    selectCustomer,
    loading: false,
    rulesLoading,
    saving,
    error: null,
    refreshSelectedCustomer,
    updateGlobalDiscount,
    addSupplierCategoryRule,
    addProductRule,
    deleteSupplierCategoryRule,
    deleteProductRule,
  };
}
