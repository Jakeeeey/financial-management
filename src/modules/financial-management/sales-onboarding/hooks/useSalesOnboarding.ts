// src/modules/financial-management/sales-onboarding/hooks/useSalesOnboarding.ts

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Salesman, Customer, SalesInvoiceType, SalesInvoice, DiscountType } from "../types";
 
export function useSalesOnboarding() {
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceTypes, setInvoiceTypes] = useState<SalesInvoiceType[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<SalesInvoice[]>([]);
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch("/api/fm/sales-onboarding");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      
      const data = await res.json();
      
      setSalesmen(data.salesmen || []);
      setCustomers(data.customers || []);
      setInvoiceTypes(data.invoiceTypes || []);
      setRecentInvoices(data.recentInvoices || []);
      setDiscountTypes(data.discountTypes || []);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error loading data";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/fm/sales-onboarding?type=recent");
      if (!res.ok) throw new Error("Failed to refresh recent invoices");
      const data = await res.json();
      setRecentInvoices(data || []);
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const submitInvoice = async (invoiceData: Omit<SalesInvoice, "order_id" | "transaction_status" | "payment_status"> & { salesman_code: string }) => {
    setIsSubmitting(true);
    try {
      // 1. Construct generated fields
      const order_id = `${invoiceData.salesman_code}${Date.now()}`;
      const transaction_status = "Onboarded";
      const payment_status = "Unpaid";
      
      // 2. Perform lookups for relational dependencies
      const sm = salesmen.find((s) => s.id === invoiceData.salesman_id);
      const cust = customers.find((c) => c.customer_code === invoiceData.customer_code);
      const invT = invoiceTypes.find((t) => t.id === invoiceData.invoice_type);

      const sales_type = sm && typeof sm.operation === "number" ? sm.operation : null;
      const payment_terms = cust?.payment_term?.id ?? null;
      const price_type = sm && sm.price_type ? sm.price_type : null;
      const isReceipt = invT && typeof invT.isOfficial === "number" ? invT.isOfficial === 1 : null;
      const total_amount = invoiceData.net_amount; // total amount which is also just the net amount

      // 3. Remove salesman_code since we don't want to submit it to DB
      const payloadFields = { ...invoiceData } as Partial<typeof invoiceData>;
      delete payloadFields.salesman_code;
      
      const payload: SalesInvoice = {
        ...(payloadFields as Omit<SalesInvoice, "order_id" | "transaction_status" | "payment_status">),
        order_id,
        transaction_status,
        payment_status,
        sales_type,
        payment_terms,
        price_type,
        isReceipt,
        total_amount,
      };

      // 4. Post to BFF API
      const res = await fetch("/api/fm/sales-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to onboard invoice");
      }

      toast.success(`Invoice ${payload.invoice_no} onboarded successfully!`);
      
      // 4. Refresh recent invoices list
      await refreshRecent();
      return true;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    salesmen,
    customers,
    invoiceTypes,
    recentInvoices,
    discountTypes,
    isLoading,
    isSubmitting,
    error,
    submitInvoice,
    refreshRecent,
  };
}
