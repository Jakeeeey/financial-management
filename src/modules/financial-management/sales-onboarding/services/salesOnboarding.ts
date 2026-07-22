// src/modules/financial-management/sales-onboarding/services/salesOnboarding.ts

import { Salesman, Customer, SalesInvoiceType, SalesInvoice, DiscountType, PaymentTerm } from "../types";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function getHeaders() {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!token) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSalesmen(): Promise<Salesman[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/salesman?limit=-1&sort=salesman_name&filter[isActive][_eq]=1&fields=id,salesman_code,salesman_name,operation.id,operation.operation_name,price_type`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch salesmen: ${res.statusText}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/customer?limit=-1&sort=customer_name&filter[isActive][_eq]=1&fields=id,customer_code,customer_name,payment_term`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.statusText}`);
  const termsRes = await fetch(
    `${DIRECTUS_URL}/items/payment_terms?limit=-1&fields=id,payment_name,payment_days`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!termsRes.ok) throw new Error(`Failed to fetch payment terms: ${termsRes.statusText}`);

  const [json, termsJson] = await Promise.all([res.json(), termsRes.json()]);

  interface RawCustomer {
    id: number;
    customer_code: string;
    customer_name: string;
    payment_term?: { id: number } | number | string | null;
  }

  interface RawPaymentTerm {
    id: number | string;
    payment_name?: string | null;
    payment_days?: number | string | null;
  }

  const rawCustomers: RawCustomer[] = json.data || [];
  const paymentTerms = new Map<number, PaymentTerm>(
    (termsJson.data || []).map((term: RawPaymentTerm) => [
      Number(term.id),
      {
        id: Number(term.id),
        payment_name: term.payment_name || "N/A",
        payment_days: term.payment_days == null ? 0 : Number(term.payment_days),
      },
    ])
  );

  return rawCustomers.map((cust: RawCustomer) => {
    const rawTermId = cust.payment_term && typeof cust.payment_term === "object"
      ? cust.payment_term.id
      : cust.payment_term;
    const termId = rawTermId == null || rawTermId === "" ? null : Number(rawTermId);

    return {
      ...cust,
      payment_term: termId != null && Number.isFinite(termId)
        ? paymentTerms.get(termId) || null
        : null,
    };
  });
}

export class SalesOnboardingValidationError extends Error {}

export async function resolveCustomerPaymentTerm(customerCode: string): Promise<number | null> {
  const customerRes = await fetch(
    `${DIRECTUS_URL}/items/customer?limit=1&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&fields=customer_code,payment_term`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!customerRes.ok) throw new Error(`Failed to resolve customer payment term: ${customerRes.statusText}`);

  const customerJson = await customerRes.json();
  const customer = customerJson.data?.[0];
  if (!customer) {
    throw new SalesOnboardingValidationError(`Customer ${customerCode} was not found.`);
  }

  const rawTermId = customer.payment_term && typeof customer.payment_term === "object"
    ? customer.payment_term.id
    : customer.payment_term;
  const termId = rawTermId == null || rawTermId === "" ? null : Number(rawTermId);
  if (termId == null) return null;
  if (!Number.isInteger(termId)) {
    throw new SalesOnboardingValidationError(`Customer ${customerCode} has an invalid payment term.`);
  }

  const termRes = await fetch(
    `${DIRECTUS_URL}/items/payment_terms/${encodeURIComponent(String(termId))}?fields=id`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!termRes.ok) {
    if (termRes.status === 404) {
      throw new SalesOnboardingValidationError(`Payment term ${termId} assigned to customer ${customerCode} does not exist.`);
    }
    throw new Error(`Failed to validate payment term: ${termRes.statusText}`);
  }

  return termId;
}

export async function fetchInvoiceTypes(): Promise<SalesInvoiceType[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/sales_invoice_type?limit=-1&sort=type&fields=id,type,isOfficial`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch invoice types: ${res.statusText}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchDiscountTypes(): Promise<DiscountType[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/discount_type?limit=-1&sort=discount_type&fields=id,discount_type,total_percent`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch discount types: ${res.statusText}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchRecentInvoices(): Promise<SalesInvoice[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/sales_invoice?limit=10&sort=-invoice_id&filter[transaction_status][_eq]=Onboarded`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch recent invoices: ${res.statusText}`);
  const json = await res.json();
  return json.data || [];
}

export async function createSalesInvoice(payload: SalesInvoice): Promise<SalesInvoice> {
  const res = await fetch(`${DIRECTUS_URL}/items/sales_invoice`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  
  const json = await res.json();
  if (!res.ok) {
    console.error("Directus create error payload:", json);
    throw new Error(json.errors?.[0]?.message || `Failed to create sales invoice: ${res.statusText}`);
  }
  return json.data;
}
