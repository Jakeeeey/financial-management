// src/app/api/fm/sales-onboarding/route.ts
 
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import {
  fetchSalesmen,
  fetchCustomers,
  fetchInvoiceTypes,
  fetchRecentInvoices,
  createSalesInvoice,
  fetchDiscountTypes,
  resolveCustomerPaymentTerm,
  SalesOnboardingValidationError,
} from "@/modules/financial-management/sales-onboarding/services/salesOnboarding";
 
export const runtime = "nodejs";
 
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const invoiceNo = searchParams.get("invoice_no");

    // 1. Debounced invoice number uniqueness pre-check
    if (invoiceNo) {
      const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      const token = process.env.DIRECTUS_STATIC_TOKEN;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const checkUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${encodeURIComponent(invoiceNo.trim())}&fields=invoice_id`;
      const checkRes = await fetch(checkUrl, { headers, cache: "no-store" });
      if (!checkRes.ok) throw new Error(`Directus uniqueness query failed: ${checkRes.statusText}`);
      const checkData = await checkRes.json();
      const exists = Array.isArray(checkData.data) && checkData.data.length > 0;
      return NextResponse.json({ exists });
    }
 
    if (type === "dropdowns") {
      const [salesmen, customers, invoiceTypes, discountTypes] = await Promise.all([
        fetchSalesmen(),
        fetchCustomers(),
        fetchInvoiceTypes(),
        fetchDiscountTypes(),
      ]);
 
      return NextResponse.json({
        salesmen,
        customers,
        invoiceTypes,
        discountTypes,
      });
    }
 
    if (type === "recent") {
      const recent = await fetchRecentInvoices();
      return NextResponse.json(recent);
    }
 
    // Default: fetch everything for dashboard load
    const [salesmen, customers, invoiceTypes, recentInvoices, discountTypes] = await Promise.all([
      fetchSalesmen(),
      fetchCustomers(),
      fetchInvoiceTypes(),
      fetchRecentInvoices(),
      fetchDiscountTypes(),
    ]);
 
    return NextResponse.json({
      salesmen,
      customers,
      invoiceTypes,
      recentInvoices,
      discountTypes,
    });
  } catch (error: unknown) {
    console.error("[Sales Onboarding API GET error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
 
export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check & Get User ID
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    const userIdVal = payload ? (payload.userId || payload.id || payload.sub) : null;
    const createdBy = userIdVal ? Number(userIdVal) : 1; // Default to 1 if no auth context in dev
 
    // 2. Parse payload
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid invoice payload is required." }, { status: 400 });
    }

    const customerCode = typeof body.customer_code === "string" ? body.customer_code.trim() : "";
    if (!customerCode) {
      return NextResponse.json({ error: "Customer is required." }, { status: 400 });
    }

    // 2.5. Double check uniqueness at save time
    const invoiceNo = body.invoice_no;
    if (invoiceNo) {
      const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      const token = process.env.DIRECTUS_STATIC_TOKEN;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const checkUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${encodeURIComponent(invoiceNo.trim())}&fields=invoice_id`;
      const checkRes = await fetch(checkUrl, { headers, cache: "no-store" });
      if (!checkRes.ok) throw new Error(`Directus uniqueness query failed: ${checkRes.statusText}`);
      const checkData = await checkRes.json();
      if (Array.isArray(checkData.data) && checkData.data.length > 0) {
        return NextResponse.json({ error: "Invoice number already exists." }, { status: 409 });
      }
    }
    
    // Resolve the relation ID from the customer instead of trusting a day count or client value.
    let paymentTermId: number | null;
    try {
      paymentTermId = await resolveCustomerPaymentTerm(customerCode);
    } catch (error) {
      if (error instanceof SalesOnboardingValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // 3. Attach Audit fields
    const finalPayload = {
      ...body,
      customer_code: customerCode,
      payment_terms: paymentTermId,
      created_by: createdBy,
      modified_by: createdBy, // modified_by is initially the creator
    };
 
    // 4. Save to Directus
    const result = await createSalesInvoice(finalPayload);
 
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[Sales Onboarding API POST error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save sales invoice" },
      { status: 500 }
    );
  }
}
