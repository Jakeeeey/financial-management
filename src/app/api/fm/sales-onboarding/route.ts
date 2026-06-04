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
} from "@/modules/financial-management/sales-onboarding/services/salesOnboarding";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "dropdowns") {
      const [salesmen, customers, invoiceTypes] = await Promise.all([
        fetchSalesmen(),
        fetchCustomers(),
        fetchInvoiceTypes(),
      ]);

      return NextResponse.json({
        salesmen,
        customers,
        invoiceTypes,
      });
    }

    if (type === "recent") {
      const recent = await fetchRecentInvoices();
      return NextResponse.json(recent);
    }

    // Default: fetch everything for dashboard load
    const [salesmen, customers, invoiceTypes, recentInvoices] = await Promise.all([
      fetchSalesmen(),
      fetchCustomers(),
      fetchInvoiceTypes(),
      fetchRecentInvoices(),
    ]);

    return NextResponse.json({
      salesmen,
      customers,
      invoiceTypes,
      recentInvoices,
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
    
    // 3. Attach Audit fields
    const finalPayload = {
      ...body,
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
