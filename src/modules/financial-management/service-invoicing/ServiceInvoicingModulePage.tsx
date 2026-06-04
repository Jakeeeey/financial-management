// src/modules/financial-management/service-invoicing/ServiceInvoicingModulePage.tsx

"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  ChevronDown,
  Check,
  Loader2,
  Calculator,
  User,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Sparkles,
  FolderSync
} from "lucide-react";
import {
  ChildInvoice,
  Salesman,
  Customer,
  SalesInvoiceType,
  CustomerSalesmanMapping,
  ConsolidatedInvoiceHistory,
  HistoryChildInvoice
} from "./types";
import {
  fetchServiceInvoicingMetadata,
  checkInvoiceNoUniqueness,
  fetchUnlinkedInvoices,
  saveServiceInvoiceConsolidation,
  fetchConsolidatedHistory
} from "./services/serviceInvoicing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  options: { value: string | number; label: string; sublabel?: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder: string;
  error?: string;
  label: string;
  icon?: React.ReactNode;
}

function KeyboardNavSelect({ options, value, onChange, placeholder, error, label, icon }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(o => String(o.value) === String(value));
  }, [options, value]);

  // Synchronize input text with selected value on changes
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(selectedOption ? selectedOption.label : "");
  }

  const filteredOptions = useMemo(() => {
    if (!isOpen) return [];
    const query = inputValue.toLowerCase().trim();
    if (!query) return options;
    return options.filter(
      o =>
        o.label.toLowerCase().includes(query) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query))
    );
  }, [options, inputValue, isOpen]);

  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, 30);
  }, [filteredOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue(selectedOption ? selectedOption.label : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        setInputValue("");
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, visibleOptions.length));
        e.preventDefault();
        break;
      case "ArrowUp":
        setHighlightedIndex(prev => (prev - 1 + visibleOptions.length) % Math.max(1, visibleOptions.length));
        e.preventDefault();
        break;
      case "Enter":
        if (visibleOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
          const selected = visibleOptions[highlightedIndex];
          onChange(selected.value);
          setInputValue(selected.label);
          setIsOpen(false);
        }
        e.preventDefault();
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        e.preventDefault();
        break;
      case "Tab":
        if (visibleOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
          const selected = visibleOptions[highlightedIndex];
          onChange(selected.value);
          setInputValue(selected.label);
        }
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
        {icon} {label}
      </label>
      
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            setInputValue("");
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className={`w-full h-10 pl-3 pr-10 text-xs rounded-xl bg-background border font-semibold focus:outline-none transition-all ${
            isOpen ? "ring-2 ring-indigo-600/20 border-indigo-500" : "border-border/60 hover:bg-muted/10"
          } ${error ? "border-red-500" : ""}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="max-h-[200px] overflow-y-auto scrollbar-thin divide-y divide-border/20">
            {visibleOptions.length === 0 ? (
              <div className="p-3 text-center italic text-xs text-muted-foreground">
                No matches found
              </div>
            ) : (
              visibleOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setInputValue(opt.label);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${
                      isHighlighted ? "bg-accent text-accent-foreground" : isSelected ? "bg-accent/40 text-indigo-600" : ""
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && <span className="text-[9px] text-muted-foreground font-medium">{opt.sublabel}</span>}
                    </div>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
    </div>
  );
}

export default function ServiceInvoicingModulePage() {
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceTypes, setInvoiceTypes] = useState<SalesInvoiceType[]>([]);
  const [customerSalesmen, setCustomerSalesmen] = useState<CustomerSalesmanMapping[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Form states
  const [invoiceNo, setInvoiceNo] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState<string | number>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | number>("");
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string | number>("");
  const [invoiceDate, setInvoiceDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [remarks, setRemarks] = useState("");
  const [grossAmount, setGrossAmount] = useState<string>("0");
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  const [childSearchQuery, setChildSearchQuery] = useState("");

  // Invoices list state
  const [childInvoices, setChildInvoices] = useState<ChildInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Uniqueness check state
  const [invoiceNoChecking, setInvoiceNoChecking] = useState(false);
  const [invoiceNoExists, setInvoiceNoExists] = useState<boolean | null>(null);

  // Selected invoices mappings state: Record<child_invoice_id, { selected, amountApplied }>
  const [selectedItems, setSelectedItems] = useState<Record<number, { selected: boolean; amountApplied: string }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState<"form" | "reports">("form");
  const [historyList, setHistoryList] = useState<ConsolidatedInvoiceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({});

  // Load History on tab change or reload
  useEffect(() => {
    if (activeTab === "reports") {
      setLoadingHistory(true);
      fetchConsolidatedHistory()
        .then((data: ConsolidatedInvoiceHistory[]) => {
          setHistoryList(data || []);
        })
        .catch((err: unknown) => {
          console.error(err);
          toast.error("Failed to load consolidation reports.");
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [activeTab, refreshKey]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase().trim();
    if (!query) return historyList;

    return historyList.filter(h => {
      const cust = customers.find(c => c.customer_code === h.customer_code);
      const custName = cust ? cust.customer_name.toLowerCase() : "";
      const parentInvoiceNo = h.invoice_no.toLowerCase();
      const customerCode = h.customer_code.toLowerCase();
      const childMatch = h.children.some((child: HistoryChildInvoice) => 
        child.child_invoice_no.toLowerCase().includes(query)
      );

      return (
        parentInvoiceNo.includes(query) ||
        customerCode.includes(query) ||
        custName.includes(query) ||
        childMatch
      );
    });
  }, [historyList, historySearch, customers]);

  const toggleParentExpand = (parentId: number) => {
    setExpandedParents(prev => ({
      ...prev,
      [parentId]: !prev[parentId]
    }));
  };

  // Load Metadata on mount
  useEffect(() => {
    setLoadingDropdowns(true);
    fetchServiceInvoicingMetadata()
      .then(data => {
        setSalesmen(data.salesmen || []);
        setCustomers(data.customers || []);
        setInvoiceTypes(data.invoiceTypes || []);
        setCustomerSalesmen(data.customerSalesmen || []);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load salesmen, customers or invoice types configuration.");
      })
      .finally(() => setLoadingDropdowns(false));
  }, []);

  // Debounced parent invoice_no uniqueness pre-check
  useEffect(() => {
    if (!invoiceNo.trim()) {
      setInvoiceNoExists(null);
      setErrorMsg("");
      return;
    }

    setInvoiceNoChecking(true);
    const timer = setTimeout(async () => {
      try {
        const exists = await checkInvoiceNoUniqueness(invoiceNo);
        setInvoiceNoExists(exists);
        if (exists) {
          setErrorMsg("This invoice number is already taken.");
        } else {
          setErrorMsg("");
        }
      } catch (err) {
        console.error("Failed to verify invoice no uniqueness", err);
      } finally {
        setInvoiceNoChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [invoiceNo]);

  // Load unlinked invoices when customer selection changes
  useEffect(() => {
    setChildSearchQuery("");
    if (!selectedCustomer) {
      setChildInvoices([]);
      setSelectedItems({});
      return;
    }

    const loadInvoices = async () => {
      setLoadingInvoices(true);
      try {
        const data = await fetchUnlinkedInvoices(String(selectedCustomer));
        setChildInvoices(data || []);
        // Reset selections on customer change
        setSelectedItems({});
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        toast.error(error.message || "Could not retrieve unlinked invoices.");
      } finally {
        setLoadingInvoices(false);
      }
    };

    loadInvoices();
  }, [selectedCustomer, refreshKey]);

  // Calculate default due date when customer or invoiceDate changes
  useEffect(() => {
    if (!selectedCustomer) return;
    const cust = customers.find(c => String(c.customer_code) === String(selectedCustomer));
    if (!cust) return;
    const terms = cust.payment_term || 0;
    if (terms > 0 && invoiceDate) {
      const baseDate = new Date(invoiceDate);
      baseDate.setDate(baseDate.getDate() + terms);
      setDueDate(baseDate.toISOString().split("T")[0]);
    } else {
      setDueDate(invoiceDate);
    }
  }, [selectedCustomer, invoiceDate, customers]);

  // Bi-directional relationships filtering based on customer_salesmen mappings

  // Allowed customer IDs based on selected salesman
  const allowedCustomerIds = useMemo(() => {
    if (!selectedSalesman) return null;
    const salesmanIdNum = Number(selectedSalesman);
    return new Set(
      customerSalesmen
        .filter(m => Number(m.salesman_id) === salesmanIdNum)
        .map(m => Number(m.customer_id))
    );
  }, [customerSalesmen, selectedSalesman]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!allowedCustomerIds) return customers;
    return customers.filter(c => allowedCustomerIds.has(Number(c.id)));
  }, [customers, allowedCustomerIds]);

  // Allowed salesman IDs based on selected customer
  const allowedSalesmanIds = useMemo(() => {
    if (!selectedCustomer) return null;
    const cust = customers.find(c => String(c.customer_code) === String(selectedCustomer));
    if (!cust) return null;
    return new Set(
      customerSalesmen
        .filter(m => Number(m.customer_id) === Number(cust.id))
        .map(m => Number(m.salesman_id))
    );
  }, [customerSalesmen, selectedCustomer, customers]);

  // Filtered salesman list
  const filteredSalesmen = useMemo(() => {
    if (!allowedSalesmanIds) return salesmen;
    return salesmen.filter(s => allowedSalesmanIds.has(Number(s.id)));
  }, [salesmen, allowedSalesmanIds]);

  // Auto-select salesman if customer has exactly one salesman linked
  useEffect(() => {
    if (selectedCustomer && !selectedSalesman && allowedSalesmanIds && allowedSalesmanIds.size === 1) {
      const singleSalesmanId = Array.from(allowedSalesmanIds)[0];
      setSelectedSalesman(singleSalesmanId);
      toast.info("Salesman auto-selected based on customer assignment.");
    }
  }, [selectedCustomer, selectedSalesman, allowedSalesmanIds]);

  // Auto-select customer if salesman has exactly one customer linked
  useEffect(() => {
    if (selectedSalesman && !selectedCustomer && allowedCustomerIds && allowedCustomerIds.size === 1) {
      const singleCustomerId = Array.from(allowedCustomerIds)[0];
      const cust = customers.find(c => Number(c.id) === singleCustomerId);
      if (cust) {
        setSelectedCustomer(cust.customer_code);
        toast.info("Customer auto-selected based on salesman assignment.");
      }
    }
  }, [selectedSalesman, selectedCustomer, allowedCustomerIds, customers]);

  // Dropdown options formatting
  const salesmanOptions = useMemo(() => {
    return filteredSalesmen.map(s => ({
      value: s.id,
      label: s.salesman_name,
      sublabel: `Code: ${s.salesman_code} | Operation: ${s.operation || "N/A"}`
    }));
  }, [filteredSalesmen]);

  const customerOptions = useMemo(() => {
    return filteredCustomers.map(c => ({
      value: c.customer_code,
      label: c.customer_name,
      sublabel: `Code: ${c.customer_code} | Payment Term: ${c.payment_term || "N/A"} days`
    }));
  }, [filteredCustomers]);

  const invoiceTypeOptions = useMemo(() => {
    return invoiceTypes.map(t => ({
      value: t.id,
      label: t.type,
      sublabel: t.isOfficial === 1 ? "Official Invoice" : "Pro-forma / Informal"
    }));
  }, [invoiceTypes]);

  const filteredChildInvoices = useMemo(() => {
    const query = childSearchQuery.toLowerCase().trim();
    if (!query) return childInvoices;
    return childInvoices.filter(inv =>
      inv.invoice_no.toLowerCase().includes(query)
    );
  }, [childInvoices, childSearchQuery]);

  // Table row select toggle handler
  const handleToggleSelect = (invoice: ChildInvoice) => {
    setSelectedItems(prev => {
      const current = prev[invoice.invoice_id];
      if (current && current.selected) {
        return {
          ...prev,
          [invoice.invoice_id]: {
            ...current,
            selected: false
          }
        };
      } else {
        return {
          ...prev,
          [invoice.invoice_id]: {
            selected: true,
            amountApplied: current?.amountApplied || invoice.total_amount.toString()
          }
        };
      }
    });
  };

  // Applied amount input change handler
  const handleAmountChange = (invoiceId: number, val: string) => {
    setSelectedItems(prev => {
      const current = prev[invoiceId] || { selected: false, amountApplied: "" };
      return {
        ...prev,
        [invoiceId]: {
          ...current,
          amountApplied: val
        }
      };
    });
  };

  // Grid/Calculations summaries
  const selectedList = useMemo(() => {
    return Object.entries(selectedItems)
      .filter(([, item]) => item.selected)
      .map(([id, item]) => ({
        invoiceId: Number(id),
        amountApplied: Number(item.amountApplied) || 0
      }));
  }, [selectedItems]);

  const totalAppliedSum = useMemo(() => {
    return selectedList.reduce((sum, item) => sum + item.amountApplied, 0);
  }, [selectedList]);

  // Sync gross amount to total applied sum on selections change
  useEffect(() => {
    setGrossAmount(totalAppliedSum.toString());
  }, [totalAppliedSum]);

  const calculatedNet = useMemo(() => {
    const gross = Number(grossAmount) || 0;
    const discount = Number(discountAmount) || 0;
    return Math.max(0, gross - discount);
  }, [grossAmount, discountAmount]);

  const totalOriginalSum = useMemo(() => {
    return selectedList.reduce((sum, item) => {
      const inv = childInvoices.find(c => c.invoice_id === item.invoiceId);
      return sum + (inv ? Number(inv.total_amount || 0) : 0);
    }, 0);
  }, [selectedList, childInvoices]);

  // Submit consolidated parent service invoice
  const handleSubmit = async () => {
    setErrorMsg("");

    if (!invoiceNo.trim()) {
      setErrorMsg("Parent Invoice Number is required.");
      return toast.error("Please enter a parent Invoice Number.");
    }
    if (invoiceNoExists) {
      return toast.error("Cannot submit: Invoice number is already taken.");
    }
    if (!selectedSalesman) {
      return toast.error("Please select a Salesman.");
    }
    if (!selectedCustomer) {
      return toast.error("Please select a Customer.");
    }
    if (!selectedInvoiceType) {
      return toast.error("Please select an Invoice Type.");
    }
    if (selectedList.length === 0) {
      return toast.error("Please select at least one sales invoice to consolidate.");
    }

    setSubmitting(true);
    try {
      const salesmanObj = salesmen.find(s => Number(s.id) === Number(selectedSalesman));
      const customerObj = customers.find(c => String(c.customer_code) === String(selectedCustomer));

      // Find latest dispatch date from selected child invoices
      let latestDispatchDate: string | null = null;
      selectedList.forEach(item => {
        const inv = childInvoices.find(c => c.invoice_id === item.invoiceId);
        if (inv && inv.dispatch_date) {
          if (!latestDispatchDate || new Date(inv.dispatch_date) > new Date(latestDispatchDate)) {
            latestDispatchDate = inv.dispatch_date;
          }
        }
      });

      const payload = {
        invoice_no: invoiceNo.trim(),
        customer_code: String(selectedCustomer),
        salesman_id: Number(selectedSalesman),
        invoice_type: Number(selectedInvoiceType),
        invoice_date: new Date(invoiceDate).toISOString(),
        due_date: new Date(dueDate).toISOString(),
        dispatch_date: latestDispatchDate ? new Date(latestDispatchDate).toISOString() : null,
        gross_amount: Number(grossAmount) || 0,
        discount_amount: Number(discountAmount) || 0,
        net_amount: calculatedNet,
        sales_type: salesmanObj && typeof salesmanObj.operation === "number" ? salesmanObj.operation : 0,
        price_type: salesmanObj && salesmanObj.price_type ? salesmanObj.price_type : "",
        payment_terms: customerObj && typeof customerObj.payment_term === "number" ? customerObj.payment_term : 0,
        remarks: remarks.trim() || null,
        mappings: selectedList.map(item => ({
          child_invoice_id: item.invoiceId,
          amount_applied: item.amountApplied
        }))
      };

      await saveServiceInvoiceConsolidation(payload);

      toast.success("Service Invoice consolidated and created successfully!");
      
      // Reset page form state
      setInvoiceNo("");
      setSelectedInvoiceType("");
      setSelectedItems({});
      setRemarks("");
      setGrossAmount("0");
      setDiscountAmount("0");
      
      // Refresh invoices lists
      setRefreshKey(prev => prev + 1);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "CONFLICT_INVOICE_NO_EXISTS") {
        setErrorMsg("This invoice number is already taken.");
        setInvoiceNoExists(true);
        toast.error("Failed to save: Invoice number already exists.");
      } else {
        toast.error(error.message || "An unexpected error occurred during creation.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-black uppercase text-foreground tracking-tight flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-indigo-500" />
            Service Invoicing Consolidation
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Consolidate multiple child sales invoices into a single parent service invoice.
          </p>
        </div>
        <Badge variant="outline" className="font-mono bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/50">
          Module Active
        </Badge>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-border/60 gap-4 mb-2">
        <button
          onClick={() => setActiveTab("form")}
          className={cn(
            "pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 px-1",
            activeTab === "form"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          New Consolidation
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={cn(
            "pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 px-1",
            activeTab === "reports"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          Consolidation Reports
        </button>
      </div>

      {activeTab === "form" ? (
        /* FORM WRAPPER */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
          
          {/* LEFT COLUMN: CRITERIA CARD */}
          <Card className="md:col-span-2 shadow-sm rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/10">
              <h2 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500"/> Invoice Consolidation Header
              </h2>
            </div>
            
            <CardContent className="p-5 space-y-5">
              
              {/* ROW 1: INVOICE NO & SALESMAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                    Invoice Number <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="E.g. SI-2026-0001"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className={cn(
                        "h-10 text-xs font-semibold rounded-xl bg-background border transition-all",
                        invoiceNoExists ? "border-red-500 focus-visible:ring-red-500" :
                        invoiceNoExists === false ? "border-emerald-500 focus-visible:ring-emerald-500" : ""
                      )}
                    />
                    {invoiceNoChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {errorMsg && (
                    <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                      <AlertCircle size={10} /> {errorMsg}
                    </p>
                  )}
                  {invoiceNoExists === false && (
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles size={10} /> Invoice number is available.
                    </p>
                  )}
                </div>

                {loadingDropdowns ? (
                  <div className="h-16 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500"/></div>
                ) : (
                  <KeyboardNavSelect
                    options={salesmanOptions}
                    value={selectedSalesman}
                    onChange={setSelectedSalesman}
                    placeholder="-- Select Salesman --"
                    label="Salesman"
                    icon={<User size={12} />}
                  />
                )}
              </div>

              {/* ROW 2: CUSTOMER & INVOICE TYPE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loadingDropdowns ? (
                  <div className="h-16 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500"/></div>
                ) : (
                  <KeyboardNavSelect
                    options={customerOptions}
                    value={selectedCustomer}
                    onChange={setSelectedCustomer}
                    placeholder="-- Search & Select Customer --"
                    label="Customer Code / Name"
                    icon={<Building2 size={12} />}
                  />
                )}

                {loadingDropdowns ? (
                  <div className="h-16 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500"/></div>
                ) : (
                  <KeyboardNavSelect
                    options={invoiceTypeOptions}
                    value={selectedInvoiceType}
                    onChange={setSelectedInvoiceType}
                    placeholder="-- Select Invoice Type --"
                    label="Invoice Type"
                    icon={<FileText size={12} />}
                  />
                )}
              </div>

              {/* ROW 3: INVOICE DATE & DUE DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                    <Calendar className="w-3 h-3 text-indigo-500" /> Invoice Date <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-10 text-xs font-semibold rounded-xl bg-background border transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                    <Calendar className="w-3 h-3 text-indigo-500" /> Due Date <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-10 text-xs font-semibold rounded-xl bg-background border transition-all"
                  />
                </div>
              </div>

              {/* ROW 4: REMARKS */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                  Remarks / Memo
                </label>
                <Input
                  placeholder="Enter invoice remarks, reason for consolidation, etc..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-10 text-xs font-semibold rounded-xl bg-background border transition-all"
                />
              </div>

              {/* CHILD INVOICES GRID */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500"/> Select Child Invoices to Consolidate
                  </label>
                  {selectedCustomer && (
                    <Badge variant="secondary" className="font-mono text-[9px] bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/50">
                      {childInvoices.length} Unlinked Invoices
                    </Badge>
                  )}
                </div>

                {!selectedCustomer ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center bg-muted/20">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Select a customer to load eligible child invoices.
                    </p>
                  </div>
                ) : loadingInvoices ? (
                  <div className="border rounded-xl p-12 flex flex-col items-center justify-center gap-2 bg-muted/10">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading customer invoices...</p>
                  </div>
                ) : childInvoices.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center bg-muted/20 space-y-1">
                    <AlertCircle className="w-5 h-5 text-indigo-500 mx-auto" />
                    <p className="text-xs font-bold text-foreground uppercase tracking-widest">No unlinked invoices found.</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      All invoices for this customer have already been linked or consolidated.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Search child invoice number..."
                      value={childSearchQuery}
                      onChange={(e) => setChildSearchQuery(e.target.value)}
                      className="h-9 text-xs font-semibold rounded-xl bg-background border border-border/60 focus-visible:ring-2 focus-visible:ring-indigo-600/20 focus-visible:border-indigo-500 transition-all"
                    />
                    
                    {filteredChildInvoices.length === 0 ? (
                      <div className="border border-dashed border-border rounded-xl p-8 text-center bg-muted/20 space-y-1">
                        <AlertCircle className="w-5 h-5 text-indigo-500 mx-auto" />
                        <p className="text-xs font-bold text-foreground uppercase tracking-widest">No matching invoices found.</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          Try adjusting your search query or clear the filter.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                          <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                              <TableRow className="border-border">
                                <TableHead className="w-[40px] text-center"></TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Invoice No</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground w-[120px]">Original Amt</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground w-[150px]">Amt Applied</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredChildInvoices.map((inv) => {
                                const state = selectedItems[inv.invoice_id] || { selected: false, amountApplied: "" };
                                return (
                                  <TableRow
                                    key={inv.invoice_id}
                                    className={cn(
                                      "border-border hover:bg-muted/30 transition-colors",
                                      state.selected ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                                    )}
                                  >
                                    <TableCell className="p-2 text-center align-middle">
                                      <Checkbox
                                        checked={state.selected}
                                        onCheckedChange={() => handleToggleSelect(inv)}
                                        className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                                      />
                                    </TableCell>
                                    <TableCell className="p-2 text-xs font-bold text-foreground">
                                      {inv.invoice_no}
                                    </TableCell>
                                    <TableCell className="p-2 text-[10px] font-bold text-muted-foreground font-mono">
                                      {inv.invoice_date ? inv.invoice_date.split("T")[0] : "N/A"}
                                    </TableCell>
                                    <TableCell className="p-2 text-xs font-black text-right text-foreground">
                                      ₱{Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="p-2 text-right">
                                      <div className="relative inline-block w-full max-w-[120px]">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">₱</span>
                                        <Input
                                          type="number"
                                          disabled={!state.selected}
                                          value={state.amountApplied}
                                          onChange={(e) => handleAmountChange(inv.invoice_id, e.target.value)}
                                          placeholder="0.00"
                                          className="h-8 pl-5 text-right text-xs font-bold bg-background shadow-none rounded-lg"
                                        />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* RIGHT COLUMN: CALCULATION & SUBMIT ACTIONS CARD */}
          <div className="space-y-6">
            
            {/* SUMMARY STATS CARD */}
            <Card className="shadow-sm rounded-2xl border border-border/50 bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border/50 bg-muted/10">
                <h2 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-500"/> Consolidation Summary
                </h2>
              </div>
              
              <CardContent className="p-5 space-y-4">
                
                <div className="flex justify-between items-center text-xs border-b border-border/40 pb-2">
                  <span className="font-bold text-muted-foreground uppercase">Selected Invoices</span>
                  <Badge variant="secondary" className="font-mono font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30">
                    {selectedList.length} Invoices
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-border/40 pb-2">
                  <span className="font-bold text-muted-foreground uppercase">Original Total Sum</span>
                  <span className="font-bold text-foreground">
                    ₱{totalOriginalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Gross Amount (₱)</label>
                    <Input
                      type="number"
                      value={grossAmount}
                      onChange={(e) => setGrossAmount(e.target.value)}
                      className="h-9 text-xs font-bold text-foreground bg-background shadow-none rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Discount Amount (₱)</label>
                    <Input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="h-9 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-background shadow-none rounded-lg"
                    />
                  </div>

                  <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/10 space-y-1 mt-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3"/> Combined Net Amount
                    </span>
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      ₱{calculatedNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-[9px] text-muted-foreground font-semibold">
                      Net = Gross - Discount. This represents the final parent invoice net total.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || selectedList.length === 0}
                  className="w-full h-11 text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 rounded-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Save Consolidation <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

              </CardContent>
            </Card>

          </div>

        </div>
      ) : (
        /* REPORTS / HISTORY UI */
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* SEARCH & FILTERS CARD */}
          <Card className="shadow-sm rounded-2xl border border-border/50 bg-card overflow-hidden">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-md">
                <Input
                  placeholder="Search by Parent SI #, Child SI #, Customer code/name..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-10 text-xs font-semibold rounded-xl bg-background border border-border/60 pl-3 pr-10 focus:outline-none"
                />
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Showing {filteredHistory.length} of {historyList.length} Consolidated Invoices
              </div>
            </CardContent>
          </Card>

          {/* REPORTS LIST */}
          {loadingHistory ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-2 bg-card border border-border/50 rounded-2xl shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading history records...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <Card className="border border-dashed border-border rounded-2xl p-12 text-center bg-muted/10 space-y-2">
              <AlertCircle className="w-8 h-8 text-indigo-500 mx-auto" />
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">No reports found</h3>
              <p className="text-xs text-muted-foreground font-semibold">
                Either there are no consolidated invoices or no records match your search criteria.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((parent) => {
                const isExpanded = !!expandedParents[parent.invoice_id];
                const cust = customers.find(c => c.customer_code === parent.customer_code);
                const salesm = salesmen.find(s => s.id === parent.salesman_id);
                const invType = invoiceTypes.find(t => t.id === parent.invoice_type);

                return (
                  <Card key={parent.invoice_id} className="shadow-sm rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-border/80 transition-all">
                    {/* Parent Header Row */}
                    <div 
                      onClick={() => toggleParentExpand(parent.invoice_id)}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 font-mono">
                            {parent.invoice_no}
                          </span>
                          <Badge variant="secondary" className="text-[9px] font-bold bg-muted text-muted-foreground uppercase">
                            {invType ? invType.type : `Type: ${parent.invoice_type}`}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                            {parent.transaction_status || "Onboarded"}
                          </Badge>
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase flex flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1"><User size={10} /> Salesman: {salesm ? salesm.salesman_name : `ID: ${parent.salesman_id}`}</span>
                          <span className="flex items-center gap-1"><Building2 size={10} /> Customer: {cust ? cust.customer_name : parent.customer_code}</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> Consolidated on: {parent.invoice_date ? parent.invoice_date.split("T")[0] : "N/A"}</span>
                        </div>
                        {parent.remarks && (
                          <div className="mt-2 text-[10px] bg-muted/40 p-2 rounded-lg text-muted-foreground italic border border-border/20 max-w-lg">
                            <strong>Remarks:</strong> {parent.remarks}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground block">Consolidated Amount</span>
                          <span className="text-sm font-black text-foreground">
                            ₱{Number(parent.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-background shrink-0">
                          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                        </div>
                      </div>
                    </div>

                    {/* Child Invoices Expansion Sub-table */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-border/30 bg-muted/5 animate-in slide-in-from-top-1 duration-200">
                        <div className="rounded-xl border border-border/50 bg-background overflow-hidden mt-2">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow className="border-border">
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Child Invoice No</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Invoice Date</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Original Amount</TableHead>
                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-indigo-600 dark:text-indigo-400">Consolidated Share</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parent.children.map((child: HistoryChildInvoice) => (
                                <TableRow key={child.mapping_id} className="border-border hover:bg-muted/10 transition-colors">
                                  <TableCell className="p-2.5 text-xs font-bold text-foreground">
                                    {child.child_invoice_no}
                                  </TableCell>
                                  <TableCell className="p-2.5 text-[10px] font-bold text-muted-foreground font-mono">
                                    {child.child_date ? child.child_date.split("T")[0] : "N/A"}
                                  </TableCell>
                                  <TableCell className="p-2.5 text-xs font-bold text-right text-foreground">
                                    ₱{Number(child.child_total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="p-2.5 text-xs font-black text-right text-indigo-600 dark:text-indigo-400">
                                    ₱{Number(child.amount_applied || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
