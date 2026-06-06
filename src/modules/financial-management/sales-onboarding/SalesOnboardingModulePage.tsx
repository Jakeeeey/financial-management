// src/modules/financial-management/sales-onboarding/SalesOnboardingModulePage.tsx

"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSalesOnboarding } from "./hooks/useSalesOnboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTableSkeleton } from "@/app/(financial-management)/fm/_components/DataTableSkeleton";
import { 
  User, 
  FileText, 
  Calendar, 
  DollarSign, 
  Plus, 
  History, 
  UserCheck, 
  Clock, 
  TrendingUp,
  ChevronDown,
  Check
} from "lucide-react";

interface FormValues {
  salesman_id: string;
  customer_code: string;
  invoice_type: string;
  invoice_no: string;
  invoice_date: string;
  dispatch_date: string;
  due_date: string;
  gross_amount: number;
  discount_amount: number;
}

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

  // Derived state to synchronize input text with selected value on prop change (e.g. form reset)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(selectedOption ? selectedOption.label : "");
  }

  // Filter options based on typed input value
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

  // Limit rendering to 30 items for high performance (fast af & no lag)
  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, 30);
  }, [filteredOptions]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Sync input back to selected label if they click away
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
        // Commit highlighted item on Tab to allow seamless click-free navigation
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
            setHighlightedIndex(0); // Reset highlight index directly in change handler
          }}
          onFocus={() => {
            setIsOpen(true);
            setInputValue(""); // Auto-clear to type immediately
            setHighlightedIndex(0); // Reset highlight index directly in focus handler
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className={`w-full h-10 pl-3 pr-10 text-xs rounded-xl bg-background border font-semibold focus:outline-none transition-all ${
            isOpen ? "ring-2 ring-blue-600/20 border-blue-500" : "border-border/60 hover:bg-muted/10"
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
                      isHighlighted ? "bg-accent text-accent-foreground" : isSelected ? "bg-accent/40 text-blue-600" : ""
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && <span className="text-[9px] text-muted-foreground font-medium">{opt.sublabel}</span>}
                    </div>
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
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

export default function SalesOnboardingModulePage() {
  const {
    salesmen,
    customers,
    invoiceTypes,
    recentInvoices,
    isLoading,
    isSubmitting,
    submitInvoice,
  } = useSalesOnboarding();

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      salesman_id: "",
      customer_code: "",
      invoice_type: "",
      invoice_no: "",
      invoice_date: todayStr,
      dispatch_date: todayStr,
      due_date: todayStr,
      gross_amount: 0,
      discount_amount: 0,
    },
  });

  // Watch fields for reactive calculation
  const gross = useWatch({ control, name: "gross_amount", defaultValue: 0 });
  const discount = useWatch({ control, name: "discount_amount", defaultValue: 0 });
  const selectedSalesmanId = useWatch({ control, name: "salesman_id", defaultValue: "" });
  const selectedCustomerCode = useWatch({ control, name: "customer_code", defaultValue: "" });
  const selectedInvoiceType = useWatch({ control, name: "invoice_type", defaultValue: "" });
  const invoiceDate = useWatch({ control, name: "invoice_date", defaultValue: "" });

  // Reactive calculation: net = gross - discount
  const calculatedNet = useMemo(() => {
    const g = Number(gross) || 0;
    const d = Number(discount) || 0;
    return Math.max(0, g - d);
  }, [gross, discount]);

  // Calculate default due date when customer or invoiceDate changes
  useEffect(() => {
    if (!selectedCustomerCode) return;
    const cust = customers.find(c => String(c.customer_code) === String(selectedCustomerCode));
    if (!cust) return;
    const terms = cust.payment_term || 0;
    if (terms > 0 && invoiceDate) {
      const baseDate = new Date(invoiceDate);
      baseDate.setDate(baseDate.getDate() + terms);
      setValue("due_date", baseDate.toISOString().split("T")[0]);
    } else {
      setValue("due_date", invoiceDate);
    }
  }, [selectedCustomerCode, invoiceDate, customers, setValue]);

  // Find the selected salesman's code
  const selectedSalesmanCode = useMemo(() => {
    if (!selectedSalesmanId) return "";
    const sm = salesmen.find((s) => s.id === Number(selectedSalesmanId));
    return sm ? sm.salesman_code : "";
  }, [selectedSalesmanId, salesmen]);

  const onSubmit = async (data: FormValues) => {
    const success = await submitInvoice({
      salesman_id: Number(data.salesman_id),
      customer_code: data.customer_code,
      invoice_type: Number(data.invoice_type),
      invoice_no: data.invoice_no,
      invoice_date: new Date(data.invoice_date).toISOString(),
      dispatch_date: new Date(data.dispatch_date).toISOString(),
      due_date: new Date(data.due_date).toISOString(),
      gross_amount: Number(data.gross_amount),
      discount_amount: Number(data.discount_amount),
      net_amount: calculatedNet,
      salesman_code: selectedSalesmanCode,
    });

    if (success) {
      reset({
        salesman_id: "",
        customer_code: "",
        invoice_type: "",
        invoice_no: "",
        invoice_date: todayStr,
        dispatch_date: todayStr,
        due_date: todayStr,
        gross_amount: 0,
        discount_amount: 0,
      });
    }
  };

  // Maps for display lookups in audit history feed
  const salesmanMap = useMemo(() => new Map(salesmen.map(s => [s.id, s.salesman_name])), [salesmen]);
  const customerMap = useMemo(() => new Map(customers.map(c => [c.customer_code, c.customer_name])), [customers]);

  // Filter history to ONLY show transaction_status === 'Onboarded'
  const onboardedInvoices = useMemo(() => {
    return recentInvoices.filter(inv => inv.transaction_status === "Onboarded");
  }, [recentInvoices]);

  const salesmenOptions = useMemo(() => {
    return salesmen.map((s) => ({
      value: s.id,
      label: s.salesman_name,
      sublabel: `Code: ${s.salesman_code}`,
    }));
  }, [salesmen]);

  const customersOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.customer_code,
      label: c.customer_name,
      sublabel: `Code: ${c.customer_code} | Payment Term: ${c.payment_term || "N/A"} days`,
    }));
  }, [customers]);

  const invoiceTypesOptions = useMemo(() => {
    return invoiceTypes.map((t) => ({
      value: t.id,
      label: t.type,
    }));
  }, [invoiceTypes]);

  if (isLoading) {
    return (
      <div className="p-6">
        <DataTableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Module Title / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-xl text-blue-600 dark:text-blue-400">
              <TrendingUp size={22} />
            </div>
            Sales Onboarding
          </h1>
          <p className="text-xs font-medium text-muted-foreground">
            Onboard new customer sales invoices securely into the ERP system.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
            <div className="p-4 border-b border-border/50 bg-muted/10">
              <h2 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Plus size={16} className="text-blue-600" /> Onboard Sales Invoice
              </h2>
            </div>
            
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Salesman and Customer Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Salesman searchable typeable dropdown */}
                  <div className="w-full">
                    <KeyboardNavSelect
                      label="Salesman"
                      icon={<User size={12} />}
                      placeholder="Type to search Salesman..."
                      options={salesmenOptions}
                      value={selectedSalesmanId}
                      onChange={(val) => setValue("salesman_id", String(val), { shouldValidate: true })}
                      error={errors.salesman_id?.message}
                    />
                    <input type="hidden" {...register("salesman_id", { required: "Salesman is required" })} />
                  </div>

                  {/* Customer searchable typeable dropdown */}
                  <div className="w-full">
                    <KeyboardNavSelect
                      label="Customer"
                      icon={<UserCheck size={12} />}
                      placeholder="Type to search Customer..."
                      options={customersOptions}
                      value={selectedCustomerCode}
                      onChange={(val) => setValue("customer_code", String(val), { shouldValidate: true })}
                      error={errors.customer_code?.message}
                    />
                    <input type="hidden" {...register("customer_code", { required: "Customer is required" })} />
                  </div>

                </div>

                {/* Invoice Type & Invoice Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Invoice Type searchable typeable dropdown */}
                  <div className="w-full">
                    <KeyboardNavSelect
                      label="Invoice Type"
                      icon={<FileText size={12} />}
                      placeholder="Type to search Type..."
                      options={invoiceTypesOptions}
                      value={selectedInvoiceType}
                      onChange={(val) => setValue("invoice_type", String(val), { shouldValidate: true })}
                      error={errors.invoice_type?.message}
                    />
                    <input type="hidden" {...register("invoice_type", { required: "Invoice Type is required" })} />
                  </div>

                  {/* Invoice No Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <FileText size={12} /> Invoice Number
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., INV-887412"
                      {...register("invoice_no", { required: "Invoice Number is required" })}
                      className={`h-10 text-xs rounded-xl font-medium ${
                        errors.invoice_no ? "border-red-500 focus-visible:ring-red-500/20" : "border-border/60"
                      }`}
                    />
                    {errors.invoice_no && (
                      <p className="text-[10px] font-bold text-red-500">{errors.invoice_no.message}</p>
                    )}
                  </div>

                </div>

                {/* Three Dates Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Invoice Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar size={12} /> Invoice Date
                    </label>
                    <Input
                      type="date"
                      {...register("invoice_date", { required: "Invoice date is required" })}
                      className="h-10 text-xs rounded-xl font-medium border-border/60"
                    />
                  </div>

                  {/* Dispatch Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar size={12} /> Dispatch Date
                    </label>
                    <Input
                      type="date"
                      {...register("dispatch_date", { required: "Dispatch date is required" })}
                      className="h-10 text-xs rounded-xl font-medium border-border/60"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar size={12} /> Due Date
                    </label>
                    <Input
                      type="date"
                      {...register("due_date", { required: "Due date is required" })}
                      className="h-10 text-xs rounded-xl font-medium border-border/60"
                    />
                  </div>

                </div>

                {/* Financial Fields Box */}
                <div className="p-4 bg-muted/30 border border-border/50 rounded-xl space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Financial Summary</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Gross Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <DollarSign size={12} /> Gross Amount (PHP)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register("gross_amount", { 
                          required: "Gross amount is required", 
                          min: { value: 0, message: "Must be positive" },
                          valueAsNumber: true 
                        })}
                        className="h-10 text-xs rounded-xl font-medium border-border/60"
                      />
                      {errors.gross_amount && (
                        <p className="text-[10px] font-bold text-red-500">{errors.gross_amount.message}</p>
                      )}
                    </div>

                    {/* Discount Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <DollarSign size={12} /> Discount Amount (PHP)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register("discount_amount", { 
                          required: "Discount is required", 
                          min: { value: 0, message: "Must be positive" },
                          valueAsNumber: true 
                        })}
                        className="h-10 text-xs rounded-xl font-medium border-border/60"
                      />
                      {errors.discount_amount && (
                        <p className="text-[10px] font-bold text-red-500">{errors.discount_amount.message}</p>
                      )}
                    </div>

                    {/* Calculated Net Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <DollarSign size={12} /> Net Amount (PHP)
                      </label>
                      <Input
                        type="text"
                        readOnly
                        value={`₱${calculatedNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        className="h-10 text-xs rounded-xl font-black bg-blue-600/5 text-blue-600 dark:text-blue-400 border-blue-600/20 focus-visible:ring-0 select-none cursor-not-allowed"
                      />
                    </div>

                  </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Onboarding Invoice..." : "Onboard Sales Invoice"}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Audits */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/60 shadow-sm rounded-2xl bg-card overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-muted/10 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <History size={16} className="text-muted-foreground" /> Onboard History
              </h2>
              <span className="text-[9px] font-bold py-0.5 px-2 bg-muted rounded-full text-muted-foreground">Recent 10</span>
            </div>

            <CardContent className="p-0">
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[570px] scrollbar-thin">
                {onboardedInvoices.length === 0 ? (
                  <div className="p-12 text-center italic text-xs text-muted-foreground">
                    No sales invoices onboarded yet.
                  </div>
                ) : (
                  onboardedInvoices.map((inv) => (
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
                          <div className="text-foreground truncate max-w-[150px]">{customerMap.get(inv.customer_code) || inv.customer_code}</div>
                        </div>
                      </div>

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
        </div>

      </div>
    </div>
  );
}
