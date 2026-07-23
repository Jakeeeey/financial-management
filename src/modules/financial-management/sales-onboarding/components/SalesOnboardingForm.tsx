// src/modules/financial-management/sales-onboarding/components/SalesOnboardingForm.tsx

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Operation } from "../types";
import { useForm, useWatch } from "react-hook-form";
import { Plus, User, FileText, Calendar, DollarSign, TrendingUp, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KeyboardNavSelect from "./KeyboardNavSelect";
import { Salesman, Customer, SalesInvoiceType, DiscountType } from "../types";

export interface FormValues {
  salesman_id: string;
  customer_code: string;
  invoice_type: string;
  invoice_no: string;
  invoice_date: string;
  dispatch_date: string;
  due_date: string;
  gross_amount: number;
  discount_amount: number;
  discount_type_id: string;
}

interface SalesOnboardingFormProps {
  salesmen: Salesman[];
  customers: Customer[];
  invoiceTypes: SalesInvoiceType[];
  discountTypes: DiscountType[];
  isSubmitting: boolean;
  onSubmitInvoice: (
    data: FormValues,
    calculatedNet: number,
    vatAmount: number,
    ewtAmount: number,
    selectedSalesmanCode: string,
  ) => Promise<boolean>;
}

export default function SalesOnboardingForm({
  salesmen,
  customers,
  invoiceTypes,
  discountTypes,
  isSubmitting,
  onSubmitInvoice,
}: SalesOnboardingFormProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const {
    register,
    handleSubmit,
    control,
    getValues,
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
      discount_type_id: "",
    },
  });

  // Watch fields for reactive calculation
  const gross = useWatch({ control, name: "gross_amount", defaultValue: 0 });
  const discount = useWatch({ control, name: "discount_amount", defaultValue: 0 });
  const selectedSalesmanId = useWatch({ control, name: "salesman_id", defaultValue: "" });
  const selectedCustomerCode = useWatch({ control, name: "customer_code", defaultValue: "" });
  const selectedInvoiceType = useWatch({ control, name: "invoice_type", defaultValue: "" });
  const invoiceDate = useWatch({ control, name: "invoice_date", defaultValue: "" });
  const selectedDiscountTypeId = useWatch({ control, name: "discount_type_id", defaultValue: "" });

  const [invoiceNoExists, setInvoiceNoExists] = useState(false);
  const [checkingInvoiceNo, setCheckingInvoiceNo] = useState(false);
  const invoiceNoValue = useWatch({ control, name: "invoice_no", defaultValue: "" });

  // Debounced check for invoice number uniqueness
  useEffect(() => {
    const trimmed = invoiceNoValue.trim();
    if (!trimmed) {
      setInvoiceNoExists(false);
      return;
    }

    setCheckingInvoiceNo(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fm/sales-onboarding?invoice_no=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setInvoiceNoExists(!!data.exists);
        }
      } catch (err) {
        console.error("Invoice check error:", err);
      } finally {
        setCheckingInvoiceNo(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [invoiceNoValue]);

  // Reactive calculation: net = gross - discount
  const calculatedNet = useMemo(() => {
    const g = Number(gross) || 0;
    const d = Number(discount) || 0;
    return Math.max(0, g - d);
  }, [gross, discount]);

  // Calculate VAT and EWT automatically
  const isVATApplicable = useMemo(() => {
    const typeId = Number(selectedInvoiceType);
    return typeId === 1 || typeId === 2; // Charge Sales Invoice or Cash Sales Invoice
  }, [selectedInvoiceType]);

  const vatAmount = useMemo(() => {
    if (!isVATApplicable) return 0;
    return calculatedNet - (calculatedNet / 1.12);
  }, [calculatedNet, isVATApplicable]);

  const ewtAmount = useMemo(() => {
    if (!isVATApplicable) return 0;
    return (calculatedNet / 1.12) * 0.01;
  }, [calculatedNet, isVATApplicable]);

  // Calculate default due date when customer or invoiceDate changes
  useEffect(() => {
    if (!selectedCustomerCode) return;
    const cust = customers.find(c => String(c.customer_code) === String(selectedCustomerCode));
    if (!cust) return;
    const terms = cust.payment_term?.payment_days || 0;
    const currentInvoiceDate = invoiceDate || getValues("invoice_date");
    if (!currentInvoiceDate) {
      setValue("due_date", "");
      return;
    }
    if (terms > 0) {
      const baseDate = new Date(currentInvoiceDate);
      baseDate.setDate(baseDate.getDate() + terms);
      setValue("due_date", baseDate.toISOString().split("T")[0]);
    } else {
      setValue("due_date", currentInvoiceDate);
    }
  }, [selectedCustomerCode, invoiceDate, customers, getValues, setValue]);

  // Auto-calculate discount amount when discount type is selected
  useEffect(() => {
    if (selectedDiscountTypeId && selectedDiscountTypeId !== "custom") {
      const dt = discountTypes.find((t) => String(t.id) === selectedDiscountTypeId);
      if (dt) {
        const calculatedDisc = Number((Number(gross || 0) * (Number(dt.total_percent) / 100)).toFixed(2));
        setValue("discount_amount", calculatedDisc, { shouldValidate: true });
      }
    }
  }, [selectedDiscountTypeId, gross, discountTypes, setValue]);

  // Find the selected salesman's code
  const selectedSalesmanCode = useMemo(() => {
    if (!selectedSalesmanId) return "";
    const sm = salesmen.find((s) => s.id === Number(selectedSalesmanId));
    return sm ? sm.salesman_code : "";
  }, [selectedSalesmanId, salesmen]);

  // Helper to get the operation name from a salesman's operation field
  const getOperationName = useCallback((s: { operation?: number | Operation | null }): string => {
    if (!s.operation) return "";
    if (typeof s.operation === "object" && "operation_name" in s.operation) {
      return s.operation.operation_name;
    }
    return "";
  }, []);

  // Options for dropdowns
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
      sublabel: c.payment_term
        ? `Code: ${c.customer_code} | ${c.payment_term.payment_name} (${c.payment_term.payment_days} days)`
        : `Code: ${c.customer_code} | Payment Term: N/A`,
    }));
  }, [customers]);

  const invoiceTypesOptions = useMemo(() => {
    return invoiceTypes.map((t) => ({
      value: t.id,
      label: t.type,
    }));
  }, [invoiceTypes]);

  const discountTypesOptions = useMemo(() => {
    return [
      { value: "custom", label: "None / Custom (Manual)", sublabel: "Type discount amount directly" },
      ...discountTypes.map((t) => ({
        value: String(t.id),
        label: t.discount_type,
        sublabel: `Rate: ${t.total_percent}%`,
      }))
    ];
  }, [discountTypes]);

  const onFormSubmit = useCallback(async (data: FormValues) => {
    if (invoiceNoExists) return;

    const success = await onSubmitInvoice(
      data,
      calculatedNet,
      Number(vatAmount.toFixed(2)),
      Number(ewtAmount.toFixed(2)),
      selectedSalesmanCode,
    );

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
        discount_type_id: "",
      });
    }
  }, [invoiceNoExists, onSubmitInvoice, calculatedNet, vatAmount, ewtAmount, selectedSalesmanCode, reset, todayStr]);

  return (
    <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card relative">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
      <div className="p-4 border-b border-border/50 bg-muted/10">
        <h2 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <Plus size={16} className="text-blue-600" /> Onboard Sales Invoice
        </h2>
      </div>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Salesman and Customer Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText size={12} /> Invoice Number
              </label>
              <Input
                type="text"
                placeholder="e.g., INV-887412"
                {...register("invoice_no", { required: "Invoice Number is required" })}
                className={`h-10 text-xs rounded-xl font-medium ${
                  errors.invoice_no || invoiceNoExists ? "border-red-500 focus-visible:ring-red-500/20" : "border-border/60"
                }`}
              />
              {checkingInvoiceNo && (
                <p className="text-[9px] text-muted-foreground animate-pulse">Checking uniqueness in database...</p>
              )}
              {invoiceNoExists && (
                <p className="text-[10px] font-bold text-red-500">Invoice Number already exists in the database.</p>
              )}
              {errors.invoice_no && !invoiceNoExists && (
                <p className="text-[10px] font-bold text-red-500">{errors.invoice_no.message}</p>
              )}
            </div>
          </div>

          {/* Three Dates Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              {/* Discount Type */}
              <div className="w-full">
                <KeyboardNavSelect
                  label="Discount Type"
                  icon={<TrendingUp size={12} />}
                  placeholder="Select Discount Type..."
                  options={discountTypesOptions}
                  value={selectedDiscountTypeId}
                  onChange={(val) => setValue("discount_type_id", String(val), { shouldValidate: true })}
                  error={errors.discount_type_id?.message}
                />
                <input type="hidden" {...register("discount_type_id")} />
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
                  readOnly={selectedDiscountTypeId !== "" && selectedDiscountTypeId !== "custom"}
                  {...register("discount_amount", {
                    required: "Discount is required",
                    min: { value: 0, message: "Must be positive" },
                    valueAsNumber: true
                  })}
                  className={`h-10 text-xs rounded-xl font-medium ${
                    selectedDiscountTypeId !== "" && selectedDiscountTypeId !== "custom"
                      ? "bg-muted/30 text-muted-foreground cursor-not-allowed border-border/40"
                      : "border-border/60"
                  }`}
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

              {/* VAT Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DollarSign size={12} /> VAT Amount (12% PHP)
                </label>
                <Input
                  type="text"
                  readOnly
                  value={isVATApplicable ? `₱${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                  className="h-10 text-xs rounded-xl font-semibold bg-muted/20 text-muted-foreground border-border/40 focus-visible:ring-0 select-none cursor-not-allowed"
                />
              </div>

              {/* EWT Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DollarSign size={12} /> EWT Amount (1% PHP)
                </label>
                <Input
                  type="text"
                  readOnly
                  value={isVATApplicable ? `₱${ewtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                  className="h-10 text-xs rounded-xl font-semibold bg-muted/20 text-muted-foreground border-border/40 focus-visible:ring-0 select-none cursor-not-allowed"
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
  );
}
