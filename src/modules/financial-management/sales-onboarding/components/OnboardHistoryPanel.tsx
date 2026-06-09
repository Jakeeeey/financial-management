// src/modules/financial-management/sales-onboarding/components/OnboardHistoryPanel.tsx

import React, { useMemo, useState, useCallback } from "react";
import { History, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KeyboardNavSelect from "./KeyboardNavSelect";
import { SalesInvoice, Salesman, Customer, Operation } from "../types";

interface OnboardHistoryPanelProps {
  recentInvoices: SalesInvoice[];
  salesmen: Salesman[];
  customers: Customer[];
}

export default function OnboardHistoryPanel({
  recentInvoices,
  salesmen,
  customers,
}: OnboardHistoryPanelProps) {
  // History Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSalesmanId, setFilterSalesmanId] = useState<string | number>("");
  const [filterCustomerCode, setFilterCustomerCode] = useState<string | number>("");
  const [filterDateRange, setFilterDateRange] = useState("all");

  // Maps for display lookups in audit history feed
  const salesmanMap = useMemo(() => new Map(salesmen.map(s => [s.id, s.salesman_name])), [salesmen]);
  const customerMap = useMemo(() => new Map(customers.map(c => [c.customer_code, c.customer_name])), [customers]);

  // Filter history to ONLY show transaction_status === 'Onboarded'
  const onboardedInvoices = useMemo(() => {
    return recentInvoices.filter(inv => inv.transaction_status === "Onboarded");
  }, [recentInvoices]);

  // Helper to get the operation name from a salesman's operation field
  const getOperationName = useCallback((s: { operation?: number | Operation | null }): string => {
    if (!s.operation) return "";
    if (typeof s.operation === "object" && "operation_name" in s.operation) {
      return s.operation.operation_name;
    }
    return "";
  }, []);

  // Dropdown options
  const salesmenOptions = useMemo(() => {
    return salesmen.map((s) => ({
      value: s.id,
      label: s.salesman_name,
      sublabel: `Code: ${s.salesman_code}${getOperationName(s) ? ` | ${getOperationName(s)}` : ""}`,
    }));
  }, [salesmen, getOperationName]);

  const customersOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.customer_code,
      label: c.customer_name,
      sublabel: `Code: ${c.customer_code} | Payment Term: ${c.payment_term || "N/A"} days`,
    }));
  }, [customers]);

  const filterSalesmenOptions = useMemo(() => {
    return [
      { value: "", label: "All Salesmen" },
      ...salesmenOptions
    ];
  }, [salesmenOptions]);

  const filterCustomersOptions = useMemo(() => {
    return [
      { value: "", label: "All Customers" },
      ...customersOptions
    ];
  }, [customersOptions]);

  const filterDateRangeOptions = [
    { value: "all", label: "All Dates" },
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "This Month" },
  ];

  const filteredHistory = useMemo(() => {
    return onboardedInvoices.filter((inv) => {
      // Search query: Invoice No or Order No
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = inv.invoice_no?.toLowerCase().includes(q);
        const matchOrder = inv.order_id?.toLowerCase().includes(q);
        if (!matchInv && !matchOrder) return false;
      }

      // Salesman Filter
      if (filterSalesmanId && filterSalesmanId !== "") {
        if (Number(inv.salesman_id) !== Number(filterSalesmanId)) return false;
      }

      // Customer Filter
      if (filterCustomerCode && filterCustomerCode !== "") {
        if (String(inv.customer_code) !== String(filterCustomerCode)) return false;
      }

      // Date Range Filter
      if (filterDateRange && filterDateRange !== "all") {
        const invDate = inv.invoice_date ? new Date(inv.invoice_date) : null;
        if (!invDate) return false;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (filterDateRange === "today") {
          if (invDate < todayStart) return false;
        } else if (filterDateRange === "week") {
          const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (invDate < weekAgo) return false;
        } else if (filterDateRange === "month") {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (invDate < monthStart) return false;
        }
      }

      return true;
    });
  }, [onboardedInvoices, searchQuery, filterSalesmanId, filterCustomerCode, filterDateRange]);

  return (
    <Card className="border-border/60 shadow-sm rounded-2xl bg-card overflow-hidden">
      <div className="p-4 border-b border-border/50 bg-muted/10 flex justify-between items-center">
        <h2 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <History size={16} className="text-muted-foreground" /> Onboard History
        </h2>
        <span className="text-[9px] font-bold py-0.5 px-2 bg-muted rounded-full text-muted-foreground">
          Filtered: {filteredHistory.length}
        </span>
      </div>

      {/* Filter Panel */}
      <div className="p-4 border-b border-border/50 bg-muted/5 space-y-3">
        {/* Search text bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Invoice No. or Order No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-3 pr-8 text-xs rounded-xl bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>

        {/* Combobox dropdowns grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <KeyboardNavSelect
            label="Salesman"
            placeholder="All Salesmen"
            options={filterSalesmenOptions}
            value={filterSalesmanId}
            onChange={(val) => setFilterSalesmanId(val)}
          />
          <KeyboardNavSelect
            label="Customer"
            placeholder="All Customers"
            options={filterCustomersOptions}
            value={filterCustomerCode}
            onChange={(val) => setFilterCustomerCode(val)}
          />
          <KeyboardNavSelect
            label="Date Range"
            placeholder="All Dates"
            options={filterDateRangeOptions}
            value={filterDateRange}
            onChange={(val) => setFilterDateRange(String(val))}
          />
        </div>
      </div>

      <CardContent className="p-0">
        <div className="divide-y divide-border/40 overflow-y-auto max-h-[570px] scrollbar-thin">
          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center italic text-xs text-muted-foreground">
              No matching sales invoices found.
            </div>
          ) : (
            filteredHistory.map((inv) => (
              <div key={inv.invoice_id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-black text-foreground">
                      {inv.invoice_no}
                    </span>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      Order ID: <span className="font-mono font-bold">{inv.order_id}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider py-0 px-1.5 h-4.5 rounded leading-none">
                      {inv.transaction_status}
                    </Badge>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[8px] font-bold uppercase tracking-wider py-0 px-1.5 h-4.5 rounded leading-none">
                      {inv.payment_status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-muted-foreground pt-1 border-t border-dashed border-border/50">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-bold">Salesman</div>
                    <div className="text-foreground truncate max-w-[150px]">{salesmanMap.get(inv.salesman_id) || `ID: ${inv.salesman_id}`}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-bold">Customer</div>
                    <div className="text-foreground font-semibold break-words">{customerMap.get(inv.customer_code) || inv.customer_code}</div>
                  </div>
                </div>

                {/* Display VAT & EWT if Cash or Charge Sales Invoice */}
                {(inv.invoice_type === 1 || inv.invoice_type === 2) && (
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-muted-foreground bg-muted/30 p-2 rounded-lg mt-1 border border-border/30">
                    <div>
                      VAT (12%): <span className="font-mono text-foreground">₱{(inv.vat_amount || (inv.net_amount - (inv.net_amount / 1.12))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div>
                      EWT (1%): <span className="font-mono text-foreground">₱{((inv.net_amount / 1.12) * 0.01).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground bg-muted/20 p-2 rounded-lg mt-1 border border-border/30">
                  <span className="flex items-center gap-1"><Clock size={11}/> {inv.invoice_date ? inv.invoice_date.split("T")[0] : "N/A"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-right">Net</span>
                    <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-xs">
                      ₱{(inv.net_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}