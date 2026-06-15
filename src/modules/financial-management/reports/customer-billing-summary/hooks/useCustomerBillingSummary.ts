"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type {
  CustomerSearchResult,
  Customer,
  BankAccount,
  SalesmanRelation,
  SupplierCategoryDiscount,
  ProductDiscount,
  Transaction,
  SalesInvoice,
  SalesReturn,
  CustomerMemo,
  Pagination,
  UnfulfilledSalesTransaction,
  SalesInvoicePayment,
  StoreType,
  CustomerClassification,
} from "../types";

export interface CustomerBillingSummaryDetails {
  customer: Customer;
  bankAccounts: BankAccount[];
  salesmen: SalesmanRelation[];
  supplierCategoryDiscounts: SupplierCategoryDiscount[];
  productDiscounts: ProductDiscount[];
  salesInvoices: SalesInvoice[];
  salesReturns: SalesReturn[];
  unfulfilledSales: UnfulfilledSalesTransaction[];
  customerMemos: CustomerMemo[];
  transactions: Transaction[];
  payments: SalesInvoicePayment[];
}

interface RawSalesInvoice extends Omit<SalesInvoice, "gross_amount" | "discount_amount" | "net_amount" | "total_amount"> {
  gross_amount?: string | number | null;
  discount_amount?: string | number | null;
  net_amount?: string | number | null;
  total_amount?: string | number | null;
}

interface RawSalesReturn extends Omit<SalesReturn, "total_amount" | "discount_amount" | "gross_amount"> {
  total_amount?: string | number | null;
  discount_amount?: string | number | null;
  gross_amount?: string | number | null;
}

interface RawCustomerMemo extends Omit<CustomerMemo, "amount" | "applied_amount"> {
  amount?: string | number | null;
  applied_amount?: string | number | null;
}

interface RawUnfulfilledSalesTransaction extends Omit<UnfulfilledSalesTransaction, "variance_amount"> {
  variance_amount?: string | number | null;
}

interface RawSalesInvoicePayment extends Omit<SalesInvoicePayment, "paid_amount"> {
  paid_amount?: string | number | null;
}

export function useCustomerBillingSummary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<string>("payment_term_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [storeType, setStoreType] = useState<string>("");
  const [classification, setClassification] = useState<string>("");
  const [storeTypes, setStoreTypes] = useState<StoreType[]>([]);
  const [classifications, setClassifications] = useState<CustomerClassification[]>([]);
  
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [details, setDetails] = useState<CustomerBillingSummaryDetails | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch paginated customer list
  const fetchCustomers = useCallback(async (
    q: string, 
    currentPage: number, 
    currentLimit: number, 
    currentSortBy: string, 
    currentSortOrder: string,
    currentStoreType: string,
    currentClassification: string
  ) => {
    setIsSearching(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentLimit),
        sortBy: currentSortBy,
        sortOrder: currentSortOrder,
      });
      if (q.trim()) {
        queryParams.set("search", q.trim());
      }
      if (currentStoreType) {
        queryParams.set("storeType", currentStoreType);
      }
      if (currentClassification) {
        queryParams.set("classification", currentClassification);
      }
      
      const res = await fetch(`/api/fm/reports/customer-billing-summary?${queryParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load customers");
      const data = await res.json();
      
      setSearchResults(data.customers || []);
      if (data.storeTypes) {
        setStoreTypes(data.storeTypes);
      }
      if (data.classifications) {
        setClassifications(data.classifications);
      }
      setPagination(data.pagination || {
        page: currentPage,
        limit: currentLimit,
        total: (data.customers || []).length,
        totalPages: 1,
      });
    } catch (err) {
      console.error("[Fetch Customers Error]", err);
      toast.error("Failed to load customers dashboard");
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load paginated list when page, query, limit, or sort changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(searchQuery, page, limit, sortBy, sortOrder, storeType, classification);
    }, searchQuery ? 400 : 0); // debounce only when typing search

    return () => clearTimeout(timer);
  }, [searchQuery, page, limit, sortBy, sortOrder, storeType, classification, fetchCustomers]);

  // Reset page when search query changes
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Toggle sorting
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("desc"); // Default to desc (oldest days / highest configs first)
    }
    setPage(1);
  };

  // Load detailed billing, configs, and transactional histories for selected customer
  const selectCustomer = useCallback(async (id: number) => {
    setSelectedCustomerId(id);
    setIsLoadingDetails(true);
    setError(null);
    const toastId = toast.loading("Fetching customer billing & history summary...");
    try {
      const res = await fetch(`/api/fm/reports/customer-billing-summary?id=${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server returned error: ${res.statusText}`);
      
      const rawData = await res.json();

      // Explicitly parse numeric fields from API response
      const processedData = {
        ...rawData,
        salesInvoices: (rawData.salesInvoices || []).map((inv: RawSalesInvoice) => ({
          ...inv,
          gross_amount: parseFloat(String(inv.gross_amount || 0)),
          discount_amount: parseFloat(String(inv.discount_amount || 0)),
          net_amount: parseFloat(String(inv.net_amount || 0)),
          total_amount: parseFloat(String(inv.total_amount || 0)),
        })),
        salesReturns: (rawData.salesReturns || []).map((ret: RawSalesReturn) => ({
          ...ret,
          total_amount: parseFloat(ret.total_amount ? String(ret.total_amount) : "0"),
          discount_amount: parseFloat(ret.discount_amount ? String(ret.discount_amount) : "0"),
          gross_amount: parseFloat(ret.gross_amount ? String(ret.gross_amount) : "0"),
        })),
        customerMemos: (rawData.customerMemos || []).map((memo: RawCustomerMemo) => ({
          ...memo,
          amount: parseFloat(memo.amount ? String(memo.amount) : "0"),
          applied_amount: parseFloat(memo.applied_amount ? String(memo.applied_amount) : "0"),
        })),
        unfulfilledSales: (rawData.unfulfilledSales || []).map((unf: RawUnfulfilledSalesTransaction) => ({
          ...unf,
          variance_amount: parseFloat(unf.variance_amount ? String(unf.variance_amount) : "0"),
        })),
        payments: (rawData.payments || []).map((pay: RawSalesInvoicePayment) => ({
          ...pay,
          paid_amount: parseFloat(pay.paid_amount ? String(pay.paid_amount) : "0"),
        })),
      };

      setDetails(processedData);
      toast.success("Billing & history summary loaded", { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(`Failed to load customer details: ${msg}`, { id: toastId });
      setDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCustomerId(null);
    setDetails(null);
    setError(null);
  }, []);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    searchResults,
    pagination,
    page,
    setPage,
    limit,
    setLimit: changeLimit,
    sortBy,
    sortOrder,
    handleSort,
    isSearching,
    selectedCustomerId,
    selectCustomer,
    clearSelection,
    details,
    isLoadingDetails,
    error,
    storeType,
    setStoreType: (val: string) => { setStoreType(val); setPage(1); },
    classification,
    setClassification: (val: string) => { setClassification(val); setPage(1); },
    storeTypes,
    classifications,
  };
}
