import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();

interface DirectusSalesInvoice {
  invoice_id: number;
  invoice_no: string;
  customer_code: string | null;
  invoice_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  transaction_status: string | null;
  isPosted: unknown;
  remarks: string | null;
}

interface DirectusCustomer {
  customer_code: string;
  customer_name: string;
}

interface DirectusListResponse<T> {
  data?: T[];
  meta?: {
    filter_count?: number;
  };
}

function parseBit(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) return obj.data[0] === 1;
  }
  return val === '1' || val === 1;
}

async function directusFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const res = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── GET: List eligible invoices to cancel or pending requests ──────────
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);
  const userRole = payload?.role || "USER";
  const username = [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") || payload?.email || "User";

  const { searchParams } = new URL(request.url);
  const searchTerm = (searchParams.get("query") || "").trim();
  const statusTab = searchParams.get("status") || "active"; // "active" or "pending"
  
  // Pagination parameters
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));

  try {
    let filter = "";
    if (statusTab === "pending") {
      // Pending requests and unposted
      filter = 
        `filter[transaction_status][_eq]=Cancellation%20Requested` +
        `&filter[_and][0][_or][0][isPosted][_null]=true` +
        `&filter[_and][0][_or][1][isPosted][_eq]=false`;
    } else {
      // Active invoices: unposted, unpaid, and not cancelled or pending request
      filter =
        `filter[payment_status][_nin]=Paid,Fully Paid` +
        `&filter[_and][0][_or][0][isPosted][_null]=true` +
        `&filter[_and][0][_or][1][isPosted][_eq]=false` +
        `&filter[_and][1][_or][0][transaction_status][_nin]=Cancelled,CANCELLED,Cancellation%20Requested` +
        `&filter[_and][1][_or][1][transaction_status][_null]=true`;
    }

    if (searchTerm) {
      // Pre-fetch matching customers to search by customer name
      const matchingCust = await directusFetch<{ data: DirectusCustomer[] }>(
        `/items/customer?filter[customer_name][_contains]=${encodeURIComponent(searchTerm)}&fields=customer_code`
      ).catch(() => ({ data: [] }));
      const codes = matchingCust.data.map(c => c.customer_code).filter(Boolean);

      let searchOr = `&filter[_and][2][_or][0][invoice_no][_contains]=${encodeURIComponent(searchTerm)}`;
      searchOr += `&filter[_and][2][_or][1][customer_code][_contains]=${encodeURIComponent(searchTerm)}`;
      
      codes.forEach((code, idx) => {
        searchOr += `&filter[_and][2][_or][${idx + 2}][customer_code][_eq]=${encodeURIComponent(code)}`;
      });
      filter += searchOr;
    }

    const fields = [
      "invoice_id", "invoice_no", "customer_code", "invoice_date",
      "due_date", "gross_amount", "discount_amount", "payment_status",
      "transaction_status", "isPosted", "remarks"
    ].join(",");

    let pendingCount = 0;
    let res: DirectusListResponse<DirectusSalesInvoice>;

    if (statusTab === "pending" && !searchTerm) {
      res = await directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
        `/items/sales_invoice?${filter}&fields=${fields}&limit=${limit}&page=${page}&meta=filter_count&sort=-invoice_id`
      );
      pendingCount = res.meta?.filter_count || 0;
    } else {
      const [mainRes, countRes] = await Promise.all([
        directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
          `/items/sales_invoice?${filter}&fields=${fields}&limit=${limit}&page=${page}&meta=filter_count&sort=-invoice_id`
        ),
        directusFetch<DirectusListResponse<DirectusSalesInvoice>>(
          `/items/sales_invoice?filter[transaction_status][_eq]=Cancellation%20Requested&filter[_and][0][_or][0][isPosted][_null]=true&filter[_and][0][_or][1][isPosted][_eq]=false&limit=0&meta=filter_count`
        ).catch(() => ({ meta: { filter_count: 0 } }))
      ]);
      res = mainRes;
      pendingCount = countRes.meta?.filter_count || 0;
    }

    const invoices = res.data || [];
    const totalRows = res.meta?.filter_count || 0;
    const totalPages = Math.ceil(totalRows / limit);

    if (invoices.length === 0) {
      return NextResponse.json({
        role: userRole,
        username,
        rows: [],
        page,
        limit,
        totalRows: 0,
        totalPages: 0,
        pendingCount
      });
    }

    // Resolve Customer Names
    const customerCodes = Array.from(new Set(invoices.map(inv => inv.customer_code).filter((c): c is string => !!c)));
    let customersList: DirectusCustomer[] = [];
    if (customerCodes.length > 0) {
      const custRes = await directusFetch<{ data: DirectusCustomer[] }>(
        `/items/customer?filter[customer_code][_in]=${customerCodes.join(",")}&fields=customer_code,customer_name`
      ).catch(() => ({ data: [] }));
      customersList = custRes.data || [];
    }
    const customerMap = new Map<string, string>(customersList.map(c => [c.customer_code, c.customer_name]));

    const mappedRows = invoices.map(inv => {
      const match = inv.remarks?.match(/PrevStatus:\s*([A-Za-z0-9_]+)/);
      const previousStatus = match ? match[1] : "Onboarded";
      return {
        invoiceId: inv.invoice_id,
        invoiceNo: inv.invoice_no,
        customerCode: inv.customer_code,
        customerName: customerMap.get(inv.customer_code || "") || inv.customer_code || "—",
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        netAmount: Number(inv.gross_amount || 0) - Number(inv.discount_amount || 0),
        paymentStatus: inv.payment_status || "Unpaid",
        transactionStatus: inv.transaction_status || "NULL",
        remarks: inv.remarks,
        previousStatus,
      };
    });

    return NextResponse.json({
      role: userRole,
      username,
      rows: mappedRows,
      page,
      limit,
      totalRows,
      totalPages,
      pendingCount
    });
  } catch (err: unknown) {
    console.error("[GET Transaction Cancellation Error]:", err);
    return NextResponse.json(
      { message: "Server error retrieving invoices", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ── POST: Request, approve, or reject cancellation ───────────────────────
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);
  const role = payload?.role || "USER";
  const username = [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") || payload?.email || "User";

  try {
    const { action, invoiceId, reason, rejectReason, previousStatus } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ message: "invoiceId is required" }, { status: 400 });
    }

    // 1. Fetch current invoice details to verify status and grab current remarks
    const invoiceRes = await directusFetch<{ data: DirectusSalesInvoice }>(
      `/items/sales_invoice/${invoiceId}?fields=invoice_id,isPosted,transaction_status,remarks`
    );
    const invoice = invoiceRes.data;

    if (!invoice) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

    if (parseBit(invoice.isPosted)) {
      return NextResponse.json({ message: "Cannot modify a posted invoice" }, { status: 400 });
    }

    const timeString = new Date().toLocaleString("en-PH");

    if (action === "request") {
      // ── REQUEST CANCELLATION ──
      if (invoice.transaction_status === "Cancellation Requested") {
        return NextResponse.json({ message: "Cancellation has already been requested for this invoice" }, { status: 400 });
      }
      if (invoice.transaction_status === "Cancelled" || invoice.transaction_status === "CANCELLED") {
        return NextResponse.json({ message: "Invoice is already cancelled" }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json({ message: "cancellation reason is required" }, { status: 400 });
      }

      const prevStatus = invoice.transaction_status || "NULL";
      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCELLATION REQUESTED by ${username}] PrevStatus: ${prevStatus} | Reason: ${reason.trim()}`;

      await directusFetch<{ data: DirectusSalesInvoice }>(
        `/items/sales_invoice/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            transaction_status: "Cancellation Requested",
            remarks: newRemarks,
          }),
        }
      );

      return NextResponse.json({ success: true, message: "Cancellation request submitted." });

    } else if (action === "approve") {
      // ── APPROVE CANCELLATION (Admin Only) ──
      if (role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: Only Administrators can approve cancellations" }, { status: 403 });
      }

      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCEL APPROVED by ${username}]`;

      await directusFetch<{ data: DirectusSalesInvoice }>(
        `/items/sales_invoice/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            transaction_status: "CANCELLED",
            remarks: newRemarks,
          }),
        }
      );

      return NextResponse.json({ success: true, message: "Cancellation approved." });

    } else if (action === "reject") {
      // ── REJECT CANCELLATION (Admin Only) ──
      if (role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: Only Administrators can reject cancellation requests" }, { status: 403 });
      }
      if (!rejectReason || !rejectReason.trim()) {
        return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
      }

      // Revert status to what it was before request (defaulting to "Onboarded")
      const targetStatus = previousStatus && previousStatus !== "NULL" ? previousStatus : "Onboarded";
      const newRemarks = `${invoice.remarks ? invoice.remarks + "\n" : ""}[${timeString} CANCELLATION REJECTED by ${username}] Reason: ${rejectReason.trim()}`;

      await directusFetch<{ data: DirectusSalesInvoice }>(
        `/items/sales_invoice/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            transaction_status: targetStatus,
            remarks: newRemarks,
          }),
        }
      );

      return NextResponse.json({ success: true, message: "Cancellation request rejected." });

    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("[POST Transaction Cancellation Error]:", err);
    return NextResponse.json(
      { message: "Failed to process cancellation request", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
