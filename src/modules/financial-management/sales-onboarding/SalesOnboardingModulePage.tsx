// src/modules/financial-management/sales-onboarding/SalesOnboardingModulePage.tsx

"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { useSalesOnboarding } from "./hooks/useSalesOnboarding";
import { DataTableSkeleton } from "@/app/(financial-management)/fm/_components/DataTableSkeleton";
import SalesOnboardingForm, { FormValues } from "./components/SalesOnboardingForm";
import OnboardHistoryPanel from "./components/OnboardHistoryPanel";

export default function SalesOnboardingModulePage() {
  const {
    salesmen,
    customers,
    invoiceTypes,
    recentInvoices,
    discountTypes,
    isLoading,
    isSubmitting,
    submitInvoice,
  } = useSalesOnboarding();

  // Adapter: transforms form output into the hook's expected input
  const handleSubmitInvoice = async (
    data: FormValues,
    calculatedNet: number,
    vatAmount: number,
    ewtAmount: number,
    selectedSalesmanCode: string,
  ): Promise<boolean> => {
    try {
      await submitInvoice({
        salesman_id: Number(data.salesman_id),
        customer_code: data.customer_code,
        invoice_type: Number(data.invoice_type),
        invoice_no: data.invoice_no,
        invoice_date: toIsoSafe(data.invoice_date),
        dispatch_date: toIsoSafe(data.dispatch_date),
        due_date: toIsoSafe(data.due_date),
        gross_amount: Number(data.gross_amount),
        discount_amount: Number(data.discount_amount),
        net_amount: calculatedNet,
        vat_amount: vatAmount,
        salesman_code: selectedSalesmanCode,
      } as Parameters<typeof submitInvoice>[0]);
      return true;
    } catch {
      return false;
    }
  };

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
          <SalesOnboardingForm
            salesmen={salesmen}
            customers={customers}
            invoiceTypes={invoiceTypes}
            discountTypes={discountTypes}
            isSubmitting={isSubmitting}
            onSubmitInvoice={handleSubmitInvoice}
          />
        </div>

        {/* Right Column: Recent Audits */}
        <div className="lg:col-span-5 space-y-4">
          <OnboardHistoryPanel
            recentInvoices={recentInvoices}
            salesmen={salesmen}
            customers={customers}
          />
        </div>

      </div>
    </div>
  );
}

/** Converts a date string to ISO format safely */
function toIsoSafe(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}