// src/modules/financial-management/sales-onboarding/services/salesOnboarding.ts

import { Salesman, Customer, SalesInvoiceType, SalesInvoice, DiscountType } from "../types";

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
    `${DIRECTUS_URL}/items/salesman?limit=-1&sort=salesman_name&filter[isActive][_eq]=1&fields=id,salesman_code,salesman_name,operation,price_type`,
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
    `${DIRECTUS_URL}/items/customer?limit=-1&sort=customer_name&filter[isActive][_eq]=1&fields=id,customer_code,customer_name,payment_term.id,payment_term.payment_days`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.statusText}`);
  const json = await res.json();
  interface RawCustomer {
    id: number;
    customer_code: string;
    customer_name: string;
    payment_term?: { id: number; payment_days: number } | number | null;
  }

  const rawCustomers: RawCustomer[] = json.data || [];
  return rawCustomers.map((cust: RawCustomer) => {
    const termObj = cust.payment_term;
    const paymentDays = termObj && typeof termObj === "object"
      ? (termObj.payment_days || 0)
      : 0;
    return {
      ...cust,
      payment_term: paymentDays
    };
  });
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
