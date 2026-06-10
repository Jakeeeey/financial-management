import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();
const COOKIE_NAME = "vos_access_token";

// ── Directus response types ────────────────────────────────────────────────
interface DirectusSalesInvoice {
  invoice_id: number;
  invoice_no: string;
  customer_code: string | null;
  invoice_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  isPosted: unknown;
}

interface DirectusCustomer {
  customer_code: string;
  customer_name: string;
}

interface DirectusPayment   { invoice_id: number; paid_amount: number | null; }
interface DirectusReturn    { invoice_no: number; amount: number | null; }
interface DirectusMemo      {
  invoice_id: number;
  amount: number | null;
  memo_id: { type: number | null; status: string | null } | null;
}
interface DirectusUnfulfilled { sales_invoice_id: number; variance_amount: number | null; }

// ── Helpers ────────────────────────────────────────────────────────────────
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

async function directusGet<T>(path: string): Promise<T> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const res = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const json = await directusGet<{ data: T[] }>(path);
  return json.data || [];
}

async function fetchAllChunked<T>(
  basePath: string,
  idField: string,
  ids: (number | string)[],
  chunkSize = 300
): Promise<T[]> {
  if (ids.length === 0) return [];
  const separator = basePath.includes("?") ? "&" : "?";
  const chunks: (number | string)[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(chunk =>
      fetchAll<T>(`${basePath}${separator}filter[${idField}][_in]=${chunk.join(",")}`)
    )
  );
  return results.flat();
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // 1. Auth check (cookie-based; static token is used for Directus calls)
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // 2. Extract query parameter
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("query");

  if (!rawQuery || rawQuery.trim().length === 0) {
    return NextResponse.json({ message: "Missing search query" }, { status: 400 });
  }

  const searchTerm = rawQuery.trim();

  // 3. Fetch a small candidate set of unpaid (and unposted) invoices.
  //
  // Spring Boot's JPQL is:
  //   SELECT s FROM SalesInvoice s
  //   WHERE s.paymentStatus != 'Paid'
  //     AND (s.invoiceNo LIKE %q% OR s.customer.customerName LIKE %q%)
  //
  // Directus filter syntax makes the same `paymentStatus` field appear
  // across multiple OR branches awkward, so we mirror the JPA filter in
  // two steps: (a) pull candidates with `paymentStatus != Paid` AND
  // `isPosted` not true (matches the spirit of the original "unpaid"
  // search — posted invoices are out of scope for cashiering), then
  // (b) post-filter in memory using the same LIKE %q% matching the
  // JPA `OR` clause + the `remainingBalance > 0.01` rule. Top-10 cap
  // is applied last to match `PageRequest.of(0, 10)`.
  const invoiceFields = [
    "invoice_id",
    "invoice_no",
    "customer_code",
    "invoice_date",
    "due_date",
    "gross_amount",
    "discount_amount",
    "payment_status",
    "isPosted",
  ].join(",");

  const CANDIDATE_LIMIT = 200;
  const candidateFilter =
    `filter[payment_status][_neq]=Paid` +
    `&filter[_or][0][isPosted][_null]=true` +
    `&filter[_or][1][isPosted][_eq]=false` +
    `&limit=${CANDIDATE_LIMIT}` +
    `&fields=${invoiceFields}` +
    `&sort=-invoice_id`;

  const lowerQuery = searchTerm.toLowerCase();

  try {
    const candidates = await fetchAll<DirectusSalesInvoice>(
      `/items/sales_invoice?${candidateFilter}`
    ).catch(() => [] as DirectusSalesInvoice[]);

    if (candidates.length === 0) {
      return NextResponse.json([]);
    }

    const invoiceIds = candidates.map(inv => inv.invoice_id);
    const customerCodes = Array.from(
      new Set(
        candidates
          .map(inv => inv.customer_code)
          .filter((c): c is string => !!c)
      )
    );

    // Parallel lookups
    const [customers, payments, returns, memos, unfulfilled] = await Promise.all([
      fetchAllChunked<DirectusCustomer>(
        `/items/customer?limit=-1&fields=customer_code,customer_name`,
        "customer_code",
        customerCodes
      ).catch(() => [] as DirectusCustomer[]),
      fetchAllChunked<DirectusPayment>(
        `/items/sales_invoice_payments?limit=-1&fields=invoice_id,paid_amount`,
        "invoice_id",
        invoiceIds
      ).catch(() => [] as DirectusPayment[]),
      fetchAllChunked<DirectusReturn>(
        `/items/sales_invoice_sales_return?limit=-1&fields=invoice_no,amount`,
        "invoice_no",
        invoiceIds
      ).catch(() => [] as DirectusReturn[]),
      fetchAllChunked<DirectusMemo>(
        `/items/customer_memo_invoices?limit=-1&fields=invoice_id,amount,memo_id.type,memo_id.status`,
        "invoice_id",
        invoiceIds
      ).catch(() => [] as DirectusMemo[]),
      fetchAllChunked<DirectusUnfulfilled>(
        `/items/unfulfilled_sales_transaction?limit=-1&fields=sales_invoice_id,variance_amount`,
        "sales_invoice_id",
        invoiceIds
      ).catch(() => [] as DirectusUnfulfilled[]),
    ]);

    // Lookup maps
    const customerMap = new Map<string, string>(
      customers.map(c => [c.customer_code, c.customer_name])
    );

    // Aggregation maps (mirrors the AR route's logic)
    const paymentAgg = new Map<number, number>();
    for (const p of payments) {
      paymentAgg.set(
        p.invoice_id,
        (paymentAgg.get(p.invoice_id) || 0) + (Number(p.paid_amount) || 0)
      );
    }

    const returnAgg = new Map<number, number>();
    for (const r of returns) {
      returnAgg.set(
        r.invoice_no,
        (returnAgg.get(r.invoice_no) || 0) + (Number(r.amount) || 0)
      );
    }

    // Credit memos (type=1) reduce balance; debit memos (type=0|2) increase it
    const creditAgg = new Map<number, number>();
    const debitAgg  = new Map<number, number>();
    for (const m of memos) {
      if (!m.memo_id || m.memo_id.status !== "APPROVED") continue;
      const type = Number(m.memo_id.type);
      const amt  = Number(m.amount) || 0;
      if (type === 1) {
        creditAgg.set(m.invoice_id, (creditAgg.get(m.invoice_id) || 0) + amt);
      } else if (type === 0 || type === 2) {
        debitAgg.set(m.invoice_id, (debitAgg.get(m.invoice_id) || 0) + amt);
      }
    }

    const unfulfilledAgg = new Map<number, number>();
    for (const u of unfulfilled) {
      unfulfilledAgg.set(
        u.sales_invoice_id,
        (unfulfilledAgg.get(u.sales_invoice_id) || 0) +
          (Number(u.variance_amount) || 0)
      );
    }

    // Build candidates with computed fields + apply the JPA-style search filter
    // (invoiceNo OR customer.customerName) and the "remainingBalance > 0.01" rule
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = candidates
      .map(inv => {
        const customerName =
          customerMap.get(inv.customer_code || "") || inv.customer_code || "";

        const grossAmount    = Number(inv.gross_amount)    || 0;
        const discountAmount = Number(inv.discount_amount) || 0;
        const netReceivable  = grossAmount - discountAmount;
        const returnAmount   = returnAgg.get(inv.invoice_id)   || 0;
        const creditMemos    = creditAgg.get(inv.invoice_id)   || 0;
        const debitMemos     = debitAgg.get(inv.invoice_id)    || 0;
        const unfulfilledAmt = unfulfilledAgg.get(inv.invoice_id) || 0;
        const totalPaid      = paymentAgg.get(inv.invoice_id)  || 0;

        const remainingBalance = Math.max(
          0,
          netReceivable - returnAmount - creditMemos + debitMemos - unfulfilledAmt - totalPaid
        );

        // Aging days: positive = past due, negative = future, null = no due date
        let agingDays = 0;
        if (inv.due_date) {
          const due = new Date(inv.due_date);
          if (!isNaN(due.getTime())) {
            due.setHours(0, 0, 0, 0);
            agingDays = Math.floor(
              (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
            );
          }
        }

        return {
          inv,
          customerName,
          grossAmount,
          discountAmount,
          netReceivable,
          returnAmount,
          creditMemos,
          debitMemos,
          unfulfilledAmt,
          totalPaid,
          remainingBalance,
          agingDays,
        };
      })
      .filter(row => {
        // Double-check: skip any posted invoices that leaked through
        if (parseBit(row.inv.isPosted)) return false;
        // JPA filter: (invoiceNo LIKE %q% OR customer.customerName LIKE %q%)
        const matchesInvoice  = (row.inv.invoice_no || "").toLowerCase().includes(lowerQuery);
        const matchesCustomer = (row.customerName || "").toLowerCase().includes(lowerQuery);
        if (!matchesInvoice && !matchesCustomer) return false;
        // JPA filter: remainingBalance > 0.01
        if (row.remainingBalance <= 0.01) return false;
        return true;
      })
      .slice(0, 10) // Mirrors PageRequest.of(0, 10)
      .map(row => ({
        id: row.inv.invoice_id,
        invoiceId: row.inv.invoice_id,
        invoiceNo: row.inv.invoice_no,
        customerName: row.customerName,
        transactionDate: row.inv.invoice_date,
        dueDate: row.inv.due_date,
        agingDays: row.agingDays,
        originalAmount: row.netReceivable,
        totalPayments: row.totalPaid,
        totalMemos: row.creditMemos + row.debitMemos,
        totalReturns: row.returnAmount,
        remainingBalance: row.remainingBalance,
        // Detailed forensic breakdown (optional fields used by SettlementAllocation)
        grossAmount: row.grossAmount,
        discountAmount: row.discountAmount,
        returnAmount: row.returnAmount,
        appliedCreditMemos: row.creditMemos,
        appliedDebitMemos: row.debitMemos,
        unfulfilledAmount: row.unfulfilledAmt,
      }));

    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error("[BFF search-unpaid Error]:", err);
    return NextResponse.json(
      {
        message: "BFF Search Error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
