import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '');
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || '').trim();
const COOKIE_NAME = 'vos_access_token';

// ── Directus response types ────────────────────────────────────────────────
interface SalesInvoiceRow {
  invoice_id: number;
  invoice_no: string;
  order_id: string | null;
  customer_code: string | null;
  invoice_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  discount_amount: number | null;
  isPosted: unknown;
  sales_type: number | null;   // FK → operation.id
  salesman_id: number | null;
  branch_id: { branch_name: string } | null;
}

interface PaymentRow    { invoice_id: number; paid_amount: number | null; }
interface ReturnRow     { invoice_no: number; amount: number | null; }
interface MemoRow       { invoice_id: number; amount: number | null; memo_id: { type: number | null; status: string | null } | null; }
interface UnfulfilledRow{ sales_invoice_id: number; variance_amount: number | null; }
interface CustomerRow   { customer_code: string; customer_name: string; }
interface SalesmanRow   { id: number; salesman_name: string; division_id: number | null; }
interface DivisionRow   { division_id: number; division_name: string; }
interface OperationRow  { id: number; operation_name: string; operation_code: string | null; }
interface CollectionRow {
  id: number;
  salesman_id: number | null;
  totalAmount: number | null;
}
interface CollectionInvoiceRow { collection_id: number; invoice_id: number; amount: number; }

// ── Helpers ────────────────────────────────────────────────────────────────
/** Reads a MySQL BIT(1) field that Directus sends as { type:'Buffer', data:[0|1] } or boolean or null */
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

async function fetchAll<T>(url: string): Promise<T[]> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json() as { data: T[] };
  return json.data || [];
}

async function fetchAllChunked<T>(
  baseUrl: string,
  idField: string,
  ids: (number | string)[],
  chunkSize = 300
): Promise<T[]> {
  if (ids.length === 0) return [];
  const separator = baseUrl.includes('?') ? '&' : '?';
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(chunk =>
      fetchAll<T>(`${baseUrl}${separator}filter[${idField}][_in]=${chunk.join(',')}`)
    )
  );
  return results.flat();
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) {
    return NextResponse.json({ ok: false, message: 'Server misconfigured' }, { status: 500 });
  }

  try {
    // ── Invoice query: only non-posted + non-fully-paid ───────────────────
    //   payment_status NOT IN ('Paid', 'Fully Paid')
    //   AND (isPosted IS NULL OR isPosted = false/0)
    const invoiceFields = [
      'invoice_id', 'invoice_no', 'order_id', 'customer_code',
      'invoice_date', 'due_date', 'gross_amount', 'discount_amount',
      'isPosted', 'sales_type', 'salesman_id', 'branch_id.branch_name',
    ].join(',');

    const invoiceFilter =
      `filter[payment_status][_nin]=Paid,Fully Paid` +
      `&filter[_or][0][isPosted][_null]=true` +
      `&filter[_or][1][isPosted][_eq]=false`;

    const invoices = await fetchAll<SalesInvoiceRow>(
      `${DIRECTUS_URL}/items/sales_invoice?limit=-1&fields=${invoiceFields}&${invoiceFilter}`
    );

    if (invoices.length === 0) {
      return NextResponse.json({ rows: [], operationData: [] });
    }

    const invoiceIds = invoices.map((inv) => inv.invoice_id);
    const customerCodes = Array.from(
      new Set(invoices.map((inv) => inv.customer_code).filter((c): c is string => !!c))
    );
    const salesmanIds = Array.from(
      new Set(invoices.map((inv) => inv.salesman_id).filter((s): s is number => typeof s === 'number'))
    );

    // Fetch unposted collection pouch IDs (where isPosted = 0/false or NULL)
    const unpostedCollections = await fetchAll<CollectionRow>(
      `${DIRECTUS_URL}/items/collection?limit=-1&fields=id,salesman_id,totalAmount&filter[isPosted][_neq]=true&filter[isCancelled][_neq]=true`
    ).catch(() => []);
    const unpostedPouchIds = unpostedCollections.map(c => c.id);

    // ── Parallel fetch: all lookup/aggregation tables filtered to specific IDs ──
    const [
      payments,
      returns_,
      memos,
      unfulfilled,
      customers,
      salesmen,
      divisions,
      operations,
      unpostedInvoiceAllocs,
    ] = await Promise.all([
      fetchAllChunked<PaymentRow>(
        `${DIRECTUS_URL}/items/sales_invoice_payments?limit=-1&fields=invoice_id,paid_amount`,
        'invoice_id',
        invoiceIds
      ),
      fetchAllChunked<ReturnRow>(
        `${DIRECTUS_URL}/items/sales_invoice_sales_return?limit=-1&fields=invoice_no,amount`,
        'invoice_no',
        invoiceIds
      ),
      fetchAllChunked<MemoRow>(
        `${DIRECTUS_URL}/items/customer_memo_invoices?limit=-1&fields=invoice_id,amount,memo_id.type,memo_id.status`,
        'invoice_id',
        invoiceIds
      ),
      fetchAllChunked<UnfulfilledRow>(
        `${DIRECTUS_URL}/items/unfulfilled_sales_transaction?limit=-1&fields=sales_invoice_id,variance_amount`,
        'sales_invoice_id',
        invoiceIds
      ),
      fetchAllChunked<CustomerRow>(
        `${DIRECTUS_URL}/items/customer?limit=-1&fields=customer_code,customer_name`,
        'customer_code',
        customerCodes
      ),
      fetchAllChunked<SalesmanRow>(
        `${DIRECTUS_URL}/items/salesman?limit=-1&fields=id,salesman_name,division_id`,
        'id',
        salesmanIds
      ),
      fetchAll<DivisionRow>(
        `${DIRECTUS_URL}/items/division?limit=-1&fields=division_id,division_name`
      ),
      fetchAll<OperationRow>(
        `${DIRECTUS_URL}/items/operation?limit=-1&fields=id,operation_name,operation_code`
      ),
      fetchAllChunked<CollectionInvoiceRow>(
        `${DIRECTUS_URL}/items/collection_invoices?limit=-1&fields=collection_id,invoice_id,amount`,
        'collection_id',
        unpostedPouchIds
      ).catch(() => []),
    ]);

    // ── Lookup maps ───────────────────────────────────────────────────────
    const customerMap = new Map<string, string>(customers.map(c => [c.customer_code, c.customer_name]));
    const divisionMap = new Map<number, string>(divisions.map(d => [d.division_id, d.division_name]));
    const salesmanMap = new Map<number, { name: string; division: string }>(
      salesmen.map(s => [s.id, {
        name:     s.salesman_name,
        division: s.division_id ? (divisionMap.get(s.division_id) || '—') : '—',
      }])
    );
    const operationMap = new Map<number, { name: string; code: string | null }>(
      operations.map(op => [op.id, { name: op.operation_name, code: op.operation_code }])
    );

    // ── Aggregation maps ──────────────────────────────────────────────────
    const paymentAgg = new Map<number, number>();
    for (const p of payments) {
      paymentAgg.set(p.invoice_id, (paymentAgg.get(p.invoice_id) || 0) + (Number(p.paid_amount) || 0));
    }

    // sales_invoice_sales_return.invoice_no is a FK to sales_invoice.invoice_id
    const returnAgg = new Map<number, number>();
    for (const r of returns_) {
      returnAgg.set(r.invoice_no, (returnAgg.get(r.invoice_no) || 0) + (Number(r.amount) || 0));
    }

    // credit memo (type=1) reduces balance; debit memo (type=0|2) increases balance
    const creditAgg = new Map<number, number>();
    const debitAgg  = new Map<number, number>();
    for (const m of memos) {
      if (!m.memo_id || m.memo_id.status !== 'APPROVED') continue;
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
        (unfulfilledAgg.get(u.sales_invoice_id) || 0) + (Number(u.variance_amount) || 0)
      );
    }

    const unpostedAgg = new Map<number, number>();
    for (const alloc of unpostedInvoiceAllocs) {
      unpostedAgg.set(alloc.invoice_id, (unpostedAgg.get(alloc.invoice_id) || 0) + (Number(alloc.amount) || 0));
    }

    // ── Build AR rows ─────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = [];
    for (const inv of invoices) {
      // Double-check: skip any posted invoices that leaked through the filter
      if (parseBit(inv.isPosted)) continue;

      const grossAmount       = Number(inv.gross_amount)    || 0;
      const discountAmount    = Number(inv.discount_amount) || 0;
      const netReceivable     = grossAmount - discountAmount;
      const returnAmount      = returnAgg.get(inv.invoice_id)      || 0;
      const creditMemos       = creditAgg.get(inv.invoice_id)      || 0;
      const debitMemos        = debitAgg.get(inv.invoice_id)       || 0;
      const unfulfilledAmount = unfulfilledAgg.get(inv.invoice_id) || 0;
      const totalPaid         = paymentAgg.get(inv.invoice_id)     || 0;

      // GREATEST(0, net_receivable − returns − creditMemos + debitMemos − unfulfilled − paid)
      const rawBalance        = netReceivable - returnAmount - creditMemos + debitMemos - unfulfilledAmount - totalPaid;
      const outstandingBalance = Math.max(0, rawBalance);

      // Only include invoices that still carry an outstanding amount
      if (outstandingBalance <= 0) continue;

      // Days overdue: positive = past due, negative = future due, null = no due date
      let daysOverdue: number | null = null;
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        if (!isNaN(due.getTime())) {
          due.setHours(0, 0, 0, 0);
          daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const unpostedCollectionAmount = unpostedAgg.get(inv.invoice_id) || 0;
      const sm = inv.salesman_id ? salesmanMap.get(inv.salesman_id) : null;

      rows.push({
        invoiceId:          inv.invoice_id,
        invoiceNo:          inv.invoice_no,
        orderId:            inv.order_id    || '',
        customerName:       customerMap.get(inv.customer_code || '') || inv.customer_code || '—',
        customerCode:       inv.customer_code || '',
        invoiceDate:        inv.invoice_date,
        calculatedDueDate:  inv.due_date,
        grossAmount,
        discountAmount,
        netReceivable,
        returnAmount,
        unfulfilledAmount,
        appliedCreditMemos: creditMemos,
        appliedDebitMemos:  debitMemos,
        totalPaid,
        outstandingBalance,
        unpostedCollectionAmount,
        daysOverdue,          // negative = future, 0 = today, positive = overdue
        branch:   inv.branch_id?.branch_name || 'Unknown',
        salesman: sm?.name     || 'Unknown',
        division: sm?.division || '—',
        salesType: inv.sales_type ?? null,
        isPosted: false,      // always false — posted are excluded above
      });
    }

    // ── Build operationData breakdown ────────────────────────────────────────
    const operationAgg = new Map<number | string, { name: string; code: string | null; totalOutstanding: number; count: number }>();

    for (const row of rows) {
      const key = row.salesType ?? '__unknown__';
      if (!operationAgg.has(key)) {
        const op = typeof key === 'number' ? operationMap.get(key) : null;
        operationAgg.set(key, {
          name:             op?.name ?? 'Unknown',
          code:             op?.code ?? null,
          totalOutstanding: 0,
          count:            0,
        });
      }
      const entry = operationAgg.get(key)!;
      entry.totalOutstanding += row.outstandingBalance;
      entry.count            += 1;
    }

    const operationData = Array.from(operationAgg.entries())
      .map(([id, v]) => ({ id: id === '__unknown__' ? null : id, ...v }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    // Calculate option B: Total Unposted Collections Pool
    const totalUnpostedPool = unpostedCollections.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);

    // Group unposted collections by salesman name
    const salesmanUnpostedRecord: Record<string, number> = {};
    for (const c of unpostedCollections) {
      if (c.salesman_id) {
        const sm = salesmanMap.get(c.salesman_id);
        const name = sm?.name || `Salesman #${c.salesman_id}`;
        salesmanUnpostedRecord[name] = (salesmanUnpostedRecord[name] || 0) + (Number(c.totalAmount) || 0);
      }
    }

    return NextResponse.json({ 
      rows, 
      operationData, 
      totalUnpostedPool, 
      salesmanUnposted: salesmanUnpostedRecord 
    });
  } catch (err: unknown) {
    console.error('[AR API Error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load accounts receivable', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}