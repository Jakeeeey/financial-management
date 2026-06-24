// src/modules/financial-management/service-invoicing/services/serviceInvoicing.ts

import {
  ServiceInvoicingMetadata,
  ChildInvoice,
  ServiceInvoicePayload,
  ConsolidatedInvoiceHistory
} from "../types";

/**
 * Fetch reports of all linked consolidated parent service invoices
 */
export async function fetchConsolidatedHistory(): Promise<ConsolidatedInvoiceHistory[]> {
  const res = await fetch("/api/fm/service-invoicing?history=true");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to retrieve linked service invoices report.");
  }
  return res.json();
}

/**
 * Fetch dropdown options and mappings (salesmen, customers, invoice types, and customer-salesmen relationships)
 */
export async function fetchServiceInvoicingMetadata(): Promise<ServiceInvoicingMetadata> {
  const res = await fetch("/api/fm/service-invoicing/metadata");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load service invoicing metadata.");
  }
  return res.json();
}

/**
 * Verify whether an invoice number already exists in sales_invoice table
 */
export async function checkInvoiceNoUniqueness(invoiceNo: string): Promise<boolean> {
  const res = await fetch(`/api/fm/service-invoicing?invoice_no=${encodeURIComponent(invoiceNo.trim())}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to verify invoice number uniqueness.");
  }
  const data = await res.json();
  return !!data.exists;
}

/**
 * Fetch all unlinked sales invoices belonging to the selected customer
 */
export async function fetchUnlinkedInvoices(customerCode: string): Promise<ChildInvoice[]> {
  const res = await fetch(`/api/fm/service-invoicing?customer_code=${encodeURIComponent(customerCode)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to retrieve unlinked customer invoices.");
  }
  return res.json();
}

/**
 * Post the parent consolidated service invoice and its child mappings
 */
export async function saveServiceInvoiceConsolidation(payload: ServiceInvoicePayload): Promise<unknown> {
  const res = await fetch("/api/fm/service-invoicing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (res.status === 409) {
    throw new Error("CONFLICT_INVOICE_NO_EXISTS");
  }
  if (!res.ok) {
    throw new Error(data.error || "Failed to save service invoice consolidation.");
  }
  return data;
}
