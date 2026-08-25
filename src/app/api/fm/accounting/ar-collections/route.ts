/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { getARPayload } from '../accounts-receivable/_arData';
import { computeDerivedStatus } from '../accounts-receivable/_arFetchAndDerive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'vos_access_token';
const MOCK_DB_PATH = 'C:\\Users\\Admin\\.gemini\antigravity-cli\\ar_collection_mock_db.json';

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '');
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || '').trim();

interface LocalDB {
  commitments: any[];
  notes: any[];
}

function loadLocalDB(): LocalDB {
  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      const content = fs.readFileSync(MOCK_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[Collections API DB Load Error]:', err);
  }
  const defaultDB = { commitments: [], notes: [] };
  saveLocalDB(defaultDB);
  return defaultDB;
}

function saveLocalDB(data: LocalDB) {
  try {
    const dir = path.dirname(MOCK_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Collections API DB Save Error]:', err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getUserIdFromToken(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return String(payload.id || payload.user_id || payload.sub || 'user_123');
    }
  } catch {}
  return 'user_123';
}

async function getErpUserId(token: string): Promise<number> {
  let email = '';
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      email = payload.email || payload.user_email || '';
    }
  } catch {}

  if (!email && DIRECTUS_URL) {
    try {
      const resMe = await fetch(`${DIRECTUS_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resMe.ok) {
        const meData = await resMe.json();
        email = meData.data?.email || '';
      }
    } catch {}
  }

  if (email && DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
    try {
      const resUser = await fetch(`${DIRECTUS_URL}/items/user?filter[user_email][_eq]=${encodeURIComponent(email)}&limit=1`, {
        headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` }
      });
      if (resUser.ok) {
        const userData = await resUser.json();
        if (userData.data && userData.data.length > 0) {
          return Number(userData.data[0].user_id);
        }
      }
    } catch {}
  }

  return 275; // Aranjit Archita fallback
}

// Optimized helper to run requests in parallel safely
async function fetchDirectus<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.warn(`[Directus fetch failed for ${url}]:`, err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'worklist';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
  const salesman = searchParams.get('salesman') || 'all';
  const status = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  try {
    // 1. Fetch commitments first (from Directus or local mock JSON fallback)
    let commitments: any[] = [];
    let notes: any[] = [];
    const notesCount: Record<string, number> = {};

    if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
      const rawCommitments = await fetchDirectus(`${DIRECTUS_URL}/items/ar_collection_commitments?limit=-1&sort=-id&fields=*,salesman_id.salesman_name,salesman_id.salesman_code,customer_code.customer_name,customer_code.customer_code`);
      commitments = (rawCommitments || []).map((c: any) => ({
        id: String(c.id),
        invoiceNo: c.invoice_no,
        invoiceId: c.invoice_id,
        customerCode: c.customer_code?.customer_code || c.customer_code || '',
        customerName: c.customer_code?.customer_name || '',
        salesmanId: c.salesman_id?.id || c.salesman_id || null,
        salesmanName: c.salesman_id?.salesman_name || '',
        salesmanCode: c.salesman_id?.salesman_code || '',
        outstandingAmount: Number(c.outstanding_amount) || 0,
        committedAmount: Number(c.committed_amount) || 0,
        commitmentDate: c.commitment_date ? c.commitment_date.split('T')[0] : '',
        commitmentType: c.commitment_type,
        status: c.status || 'pending',
        followUpBy: c.follow_up_by,
        assignedTo: c.assigned_to,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        resolvedAt: c.resolved_at,
        daysOverdueAtAssignment: c.days_overdue_at_assignment || 0,
      }));
      notes = await fetchDirectus(`${DIRECTUS_URL}/items/ar_collection_notes?limit=-1`);
    } else {
      const db = loadLocalDB();
      commitments = db.commitments;
      notes = db.notes;
    }

    notes.forEach((n: any) => {
      const invNo = n.invoiceNo || n.invoice_no;
      if (invNo) notesCount[invNo] = (notesCount[invNo] || 0) + 1;
    });

    if (view === 'notes') {
      const invoiceNo = searchParams.get('invoiceNo');
      const invoiceNotes = notes.filter((n: any) => (n.invoiceNo || n.invoice_no) === invoiceNo);
      return NextResponse.json({ notes: invoiceNotes });
    }

    if (view === 'salesmen-list') {
      const salesmenList = await fetchDirectus<any>(`${DIRECTUS_URL}/items/salesman?limit=-1&fields=id,salesman_name,salesman_code&filter[isActive][_eq]=1`);
      const list = (salesmenList || []).map((s: any) => ({
        id: s.id,
        name: s.salesman_name,
        code: s.salesman_code || '',
        label: s.salesman_name && s.salesman_code ? `${s.salesman_name} [${s.salesman_code}]` : s.salesman_name || 'Unknown'
      }));
      return NextResponse.json({ salesmen: list });
    }

    // If they just want the calendar view, return the commitments directly (requires no invoices)
    if (view === 'calendar') {
      return NextResponse.json({ commitments, notesCount });
    }

    // 2. Fetch Outstanding Invoices with Server-side Pagination & Filtering
    // We will build a query to retrieve only the required invoices for the current page
    let directusFilter = `filter[payment_status][_nin]=Paid,Fully Paid&filter[_or][0][isPosted][_null]=true&filter[_or][1][isPosted][_eq]=false`;

    // A. Apply Salesman filter
    if (salesman !== 'all') {
      const match = salesman.match(/\[(.*?)\]/);
      const code = match ? match[1] : null;
      if (code) {
        const salesmenList = await fetchDirectus<any>(`${DIRECTUS_URL}/items/salesman?filter[salesman_code][_eq]=${encodeURIComponent(code)}&limit=1`);
        if (salesmenList.length > 0) {
          directusFilter += `&filter[salesman_id][_eq]=${salesmenList[0].id}`;
        } else {
          return NextResponse.json({ commitments: [], mergedRows: [], totalPages: 0, totalCount: 0, notesCount });
        }
      } else {
        const salesmenList = await fetchDirectus<any>(`${DIRECTUS_URL}/items/salesman?filter[salesman_name][_eq]=${encodeURIComponent(salesman)}&limit=1`);
        if (salesmenList.length > 0) {
          directusFilter += `&filter[salesman_id][_eq]=${salesmenList[0].id}`;
        } else {
          return NextResponse.json({ commitments: [], mergedRows: [], totalPages: 0, totalCount: 0, notesCount });
        }
      }
    }

    // B. Apply Text Search (searches customer names, invoice numbers, or salesman names)
    if (search) {
      const searchEsc = encodeURIComponent(search.trim());
      // Find matching customers first to get customer codes
      const customersList = await fetchDirectus<any>(`${DIRECTUS_URL}/items/customer?filter[customer_name][_contains]=${searchEsc}&fields=customer_code`);
      const codes = customersList.map(c => c.customer_code).filter(Boolean);

      // Find matching salesmen first to get salesman IDs
      const salesmenList = await fetchDirectus<any>(`${DIRECTUS_URL}/items/salesman?filter[salesman_name][_contains]=${searchEsc}&fields=id`);
      const salesmanIds = salesmenList.map(s => s.id).filter(Boolean);

      let orIndex = 0;
      const orParams = [];

      if (codes.length > 0) {
        orParams.push(`filter[_or][${orIndex++}][customer_code][_in]=${codes.join(',')}`);
      }
      if (salesmanIds.length > 0) {
        orParams.push(`filter[_or][${orIndex++}][salesman_id][_in]=${salesmanIds.join(',')}`);
      }
      orParams.push(`filter[_or][${orIndex++}][invoice_no][_contains]=${searchEsc}`);

      directusFilter += `&${orParams.join('&')}`;
    }

    // C. Apply PTP Status filtering server-side
    if (status !== 'all') {
      const matchingCommitments = commitments.filter(c => {
        if (status === 'unassigned') return false; // unassigned requires not having any commitment
        return c.status === status;
      });

      const invoiceNos = matchingCommitments.map(c => c.invoiceNo);
      
      if (status === 'unassigned') {
        const assignedInvoiceNos = commitments.map(c => c.invoiceNo);
        if (assignedInvoiceNos.length > 0) {
          // Directus doesn't support _nin easily for large sets, so we'll fetch them and filter locally,
          // but if there are too many, we filter using chunks. Let's do local slicing for 'unassigned'.
        }
      } else {
        if (invoiceNos.length > 0) {
          // Only fetch invoices that have these matching commitments
          // Directus limit chunking
          directusFilter += `&filter[invoice_no][_in]=${invoiceNos.slice(0, 100).join(',')}`;
        } else {
          // No matching commitments for this status
          return NextResponse.json({ commitments: [], mergedRows: [], totalPages: 0, totalCount: 0, notesCount });
        }
      }
    }

    // Fetch the paginated sales invoices
    const offset = (page - 1) * pageSize;
    const fields = [
      'invoice_id', 'invoice_no', 'order_id', 'customer_code',
      'invoice_date', 'due_date', 'gross_amount', 'discount_amount',
      'total_amount', 'net_amount',
      'isPosted', 'sales_type', 'salesman_id', 'branch_id.branch_name',
      'dispatch_date', 'payment_status', 'transaction_status',
    ].join(',');

    const url = `${DIRECTUS_URL}/items/sales_invoice?fields=${fields}&${directusFilter}&limit=${pageSize}&offset=${offset}&meta=filter_count`;
    
    const resInv = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
      },
      cache: 'no-store',
    });

    if (!resInv.ok) {
      throw new Error(`Directus query failed: ${resInv.statusText}`);
    }

    const jsonInv = await resInv.json();
    const rawInvoices = jsonInv.data || [];
    const totalCount = Number(jsonInv.meta?.filter_count || rawInvoices.length);
    const totalPages = Math.ceil(totalCount / pageSize);

    if (rawInvoices.length === 0) {
      return NextResponse.json({ commitments, mergedRows: [], totalPages: 0, totalCount: 0, notesCount });
    }

    // 3. Query additional details ONLY for the invoices on the current page (max 20)
    // This is the core optimization - fetching details for 20 rows instead of 10,000!
    const pageInvoiceIds = rawInvoices.map((inv: any) => inv.invoice_id);
    const pageInvoiceNos = rawInvoices.map((inv: any) => inv.invoice_no).filter(Boolean);
    const pageCustomerCodes = Array.from(new Set(rawInvoices.map((inv: any) => inv.customer_code).filter(Boolean)));
    const pageSalesmanIds = Array.from(new Set(rawInvoices.map((inv: any) => inv.salesman_id).filter((s: any) => typeof s === 'number')));

    const [payments, returns, customers, salesmen, dispatchInvoices, transmittalDetails, counteredInvoices, collectionInvoices] = await Promise.all([
      fetchDirectus<any>(`${DIRECTUS_URL}/items/sales_invoice_payments?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,paid_amount`),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/sales_invoice_sales_return?filter[invoice_no][_in]=${pageInvoiceNos.join(',')}&fields=invoice_no,amount`),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/customer?filter[customer_code][_in]=${pageCustomerCodes.join(',')}&fields=customer_code,customer_name`),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/salesman?filter[id][_in]=${pageSalesmanIds.join(',')}&fields=id,salesman_name,salesman_code`),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/post_dispatch_invoices?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,status,post_dispatch_plan_id.status`).catch(() => []),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/document_transmittal_details?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,receivedAt,document_transmittal_id.receivedAt`).catch(() => []),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/countered_invoices?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,countered_date`).catch(() => []),
      fetchDirectus<any>(`${DIRECTUS_URL}/items/collection_invoices?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,collection_id.isPosted,collection_id.isCancelled`).catch(() => []),
    ]);

    // Map raw data for easy lookup
    const customerMap = new Map(customers.map(c => [c.customer_code, c.customer_name]));
    const salesmanMap = new Map(salesmen.map(s => [s.id, { name: s.salesman_name, code: s.salesman_code || '—' }]));

    const paymentAgg = new Map<number, number>();
    payments.forEach(p => paymentAgg.set(p.invoice_id, (paymentAgg.get(p.invoice_id) || 0) + (Number(p.paid_amount) || 0)));

    const returnAgg = new Map<string, number>();
    returns.forEach(r => returnAgg.set(r.invoice_no, (returnAgg.get(r.invoice_no) || 0) + (Number(r.amount) || 0)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build the final merged rows list
    const mergedRows = rawInvoices.map((inv: any) => {
      const grossAmount = Number(inv.gross_amount) || 0;
      const discountAmount = Number(inv.discount_amount) || 0;
      const netReceivable = grossAmount - discountAmount;
      const returnAmount = returnAgg.get(inv.invoice_no) || 0;
      const totalPaid = paymentAgg.get(inv.invoice_id) || 0;
      const outstanding = Math.max(0, netReceivable - returnAmount - totalPaid);

      let daysOverdue: number | null = null;
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        if (!isNaN(due.getTime())) {
          due.setHours(0, 0, 0, 0);
          daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const sm = inv.salesman_id ? salesmanMap.get(inv.salesman_id) : null;
      const invoiceData = {
        id: String(inv.invoice_id),
        invoiceNo: inv.invoice_no,
        orderId: inv.order_id || '',
        customer: customerMap.get(inv.customer_code || '') || inv.customer_code || '—',
        customerCode: inv.customer_code || '',
        invoiceDate: inv.invoice_date,
        due: inv.due_date,
        netReceivable,
        totalPaid,
        outstanding,
        overdue: daysOverdue,
        branch: inv.branch_id?.branch_name || 'Unknown',
        salesman: sm?.name || 'Unknown',
        salesmanCode: sm?.code || '—',
        division: '—',
        status: daysOverdue !== null && daysOverdue >= 0 && outstanding > 0 ? 'Overdue' : 'Due',
        grossAmount,
        discountAmount,
        returnAmount,
        unfulfilledAmount: 0,
        appliedCreditMemos: 0,
        appliedDebitMemos: 0,
        unpostedCollectionAmount: 0,
        isPosted: false,
        salesType: inv.sales_type ?? null,
        deliveryDate: inv.dispatch_date || '',
        arStatus: daysOverdue !== null && daysOverdue >= 0 && outstanding > 0 ? 'Overdue' : (inv.dispatch_date ? 'Due' : '—'),
        paymentStatus: inv.payment_status || 'Unpaid',
        transactionStatus: computeDerivedStatus(
          inv.invoice_id,
          inv.payment_status || 'Unpaid',
          inv.transaction_status,
          totalPaid,
          { dispatchInvoices, transmittalDetails, counteredInvoices, collectionInvoices }
        ),
        cluster: 'Unassigned',
      };

      const commitment = commitments.find(c => c.invoiceNo === inv.invoice_no) || null;

      return {
        invoice: invoiceData,
        commitment,
        notesCount: notesCount[inv.invoice_no] || 0,
      };
    });

    // Build filter options (simple list of unique salesmen for filter selects)
    const salesmenOptions = Array.from(new Set(
      Array.from(salesmanMap.values())
        .map(s => s.name && s.code && s.code !== '—' ? `${s.name} [${s.code}]` : s.name)
        .filter(Boolean)
    ));

    // Fetch total AR outstanding from cache (instantaneous, uses pre-fetched copy!)
    let totalAROutstanding = 0;
    try {
      const arPayload = await getARPayload('ar_collections_metrics');
      totalAROutstanding = arPayload.metrics.totalOutstanding;
    } catch (err) {
      console.warn('Failed to read AR metrics cache:', err);
    }

    // Compute stats globally on the server without client overhead
    const totalCommitted = commitments.reduce((sum, c) => sum + (Number(c.committedAmount) || 0), 0);
    const brokenCount = commitments.filter(c => c.status === 'broken').length;
    const stats = {
      totalOutstanding: totalAROutstanding,
      totalCommitted,
      brokenCount,
      pendingCount: Math.max(0, totalCount - commitments.length),
    };

    return NextResponse.json({
      commitments,
      mergedRows,
      totalPages,
      totalCount,
      notesCount,
      stats,
      filterOptions: {
        salesmen: salesmenOptions,
      }
    });
  } catch (err: unknown) {
    console.error('[Collections API GET error]:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load collections data', details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const erpUserId = await getErpUserId(token);

  try {
    const body = await request.json();

    // Standalone note creation support
    if (body.action === 'addNote' || (body.noteText && !body.commitmentDate && body.invoiceNo)) {
      const newNote = {
        id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        commitmentId: body.commitmentId || null,
        invoiceNo: body.invoiceNo,
        noteType: body.noteType || 'remark',
        noteText: body.noteText,
        createdBy: String(erpUserId),
        createdAt: new Date().toISOString(),
      };

      if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
        try {
          const directusNotePayload = {
            commitment_id: body.commitmentId || null,
            invoice_no: body.invoiceNo,
            note_type: body.noteType || 'remark',
            note_text: body.noteText,
            created_by: erpUserId,
            created_at: new Date().toISOString(),
          };

          const res = await fetch(`${DIRECTUS_URL}/items/ar_collection_notes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            },
            body: JSON.stringify(directusNotePayload),
          });
          if (res.ok) {
            return NextResponse.json({ ok: true, note: newNote });
          } else {
            const errText = await res.text();
            console.error('[Collections API] Directus standalone note POST failed:', res.status, errText);
          }
        } catch (err) {
          console.warn('[Collections API] Directus note insert failed, falling back to local DB:', err);
        }
      }

      const db = loadLocalDB();
      db.notes.push(newNote);
      saveLocalDB(db);
      return NextResponse.json({ ok: true, note: newNote });
    }

    const { salesmanId, commitmentDate, noteText } = body;
    if (!salesmanId || !commitmentDate) {
      return NextResponse.json({ ok: false, error: 'salesmanId and commitmentDate are required' }, { status: 400 });
    }

    const resolvedSalesmanId = Number(salesmanId);

    // Fetch all outstanding invoices for this salesman
    let rawInvoices: any[] = [];
    if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
      try {
        const fields = 'invoice_id,invoice_no,customer_code,salesman_id,gross_amount,discount_amount';
        const directusFilter = `filter[salesman_id][_eq]=${resolvedSalesmanId}&filter[payment_status][_neq]=Paid`;
        const resInv = await fetch(`${DIRECTUS_URL}/items/sales_invoice?fields=${fields}&${directusFilter}&limit=200`, {
          headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` }
        });
        if (resInv.ok) {
          const jsonInv = await resInv.json();
          rawInvoices = jsonInv.data || [];
        }
      } catch (err) {
        console.error('[Collections API] Failed to fetch outstanding invoices in POST:', err);
      }
    }

    if (rawInvoices.length === 0) {
      return NextResponse.json({ ok: true, count: 0, message: 'No outstanding invoices found for this salesman.' });
    }

    // Fetch payments and returns to calculate actual outstanding
    const pageInvoiceIds = rawInvoices.map((inv: any) => inv.invoice_id);
    const pageInvoiceNos = rawInvoices.map((inv: any) => inv.invoice_no).filter(Boolean);

    let payments: any[] = [];
    let returns: any[] = [];

    if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
      try {
        [payments, returns] = await Promise.all([
          fetchDirectus<any>(`${DIRECTUS_URL}/items/sales_invoice_payments?filter[invoice_id][_in]=${pageInvoiceIds.join(',')}&fields=invoice_id,paid_amount`),
          fetchDirectus<any>(`${DIRECTUS_URL}/items/sales_invoice_sales_return?filter[invoice_no][_in]=${pageInvoiceNos.join(',')}&fields=invoice_no,amount`),
        ]);
      } catch (err) {
        console.error('[Collections API] Failed to fetch payments/returns in POST:', err);
      }
    }

    const paymentAgg = new Map<number, number>();
    payments.forEach(p => paymentAgg.set(p.invoice_id, (paymentAgg.get(p.invoice_id) || 0) + (Number(p.paid_amount) || 0)));

    const returnAgg = new Map<string, number>();
    returns.forEach(r => returnAgg.set(r.invoice_no, (returnAgg.get(r.invoice_no) || 0) + (Number(r.amount) || 0)));

    const commitmentsToCreate: any[] = [];
    const notesToCreate: any[] = [];

    rawInvoices.forEach((inv: any) => {
      const grossAmount = Number(inv.gross_amount) || 0;
      const discountAmount = Number(inv.discount_amount) || 0;
      const netReceivable = grossAmount - discountAmount;
      const returnAmount = returnAgg.get(inv.invoice_no) || 0;
      const totalPaid = paymentAgg.get(inv.invoice_id) || 0;
      const outstanding = Math.max(0, netReceivable - returnAmount - totalPaid);

      if (outstanding > 0) {
        commitmentsToCreate.push({
          invoice_no: inv.invoice_no,
          invoice_id: inv.invoice_id,
          customer_code: inv.customer_code,
          salesman_id: resolvedSalesmanId,
          outstanding_amount: outstanding,
          committed_amount: outstanding, // Always full payment!
          commitment_date: commitmentDate,
          commitment_type: 'full',
          status: 'pending',
          follow_up_by: resolvedSalesmanId,
          assigned_to: resolvedSalesmanId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          resolved_at: null,
          days_overdue_at_assignment: 0,
          created_by: erpUserId,
        });

        if (noteText) {
          notesToCreate.push({
            invoice_no: inv.invoice_no,
            note_type: 'promise',
            note_text: noteText,
            created_by: erpUserId,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    if (commitmentsToCreate.length === 0) {
      return NextResponse.json({ ok: true, count: 0, message: 'All outstanding invoices have 0 balance.' });
    }

    if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
      try {
        const resWrite = await fetch(`${DIRECTUS_URL}/items/ar_collection_commitments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
          },
          body: JSON.stringify(commitmentsToCreate),
        });

        if (resWrite.ok) {
          if (notesToCreate.length > 0) {
            await fetch(`${DIRECTUS_URL}/items/ar_collection_notes`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
              },
              body: JSON.stringify(notesToCreate),
            });
          }
          return NextResponse.json({ ok: true, count: commitmentsToCreate.length });
        } else {
          const txt = await resWrite.text();
          console.error('[Collections API] Directus batch insert failed:', resWrite.status, txt);
          return NextResponse.json({ ok: false, error: 'Database insert failed', details: txt }, { status: 500 });
        }
      } catch (err) {
        console.error('[Collections API] Database write error:', err);
        return NextResponse.json({ ok: false, error: 'Database write error', details: String(err) }, { status: 500 });
      }
    }

    // Local DB fallback
    const db = loadLocalDB();
    const localCommitments = commitmentsToCreate.map(c => ({
      id: `ptp-${Date.now()}-${Math.random()}`,
      invoiceNo: c.invoice_no,
      invoiceId: c.invoice_id,
      customerCode: c.customer_code,
      salesmanId: c.salesman_id,
      outstandingAmount: c.outstanding_amount,
      committedAmount: c.committed_amount,
      commitmentDate: c.commitment_date,
      commitmentType: c.commitment_type,
      status: c.status,
      followUpBy: String(c.follow_up_by),
      assignedTo: String(c.assigned_to),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      resolvedAt: c.resolved_at,
      daysOverdueAtAssignment: c.days_overdue_at_assignment,
      createdBy: String(c.created_by),
    }));
    db.commitments.push(...localCommitments);
    saveLocalDB(db);

    return NextResponse.json({ ok: true, count: localCommitments.length });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: 'Failed to create commitment', details: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const erpUserId = await getErpUserId(token);

  try {
    const body = await request.json();
    const { commitmentId, status, noteText } = body;

    // Try Directus patch
    if (DIRECTUS_URL && DIRECTUS_STATIC_TOKEN) {
      try {
        const res = await fetch(`${DIRECTUS_URL}/items/ar_collection_commitments/${commitmentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
          },
          body: JSON.stringify({
            status,
            updated_at: new Date().toISOString(),
            resolved_at: status !== 'pending' ? new Date().toISOString() : null,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          if (noteText) {
            const directusNotePayload = {
              commitment_id: commitmentId,
              invoice_no: updated.data?.invoice_no || '',
              note_type: status === 'kept' ? 'resolution' : 'escalation',
              note_text: noteText,
              created_by: erpUserId,
              created_at: new Date().toISOString(),
            };
            await fetch(`${DIRECTUS_URL}/items/ar_collection_notes`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
              },
              body: JSON.stringify(directusNotePayload),
            });
          }
          return NextResponse.json({ ok: true });
        } else {
          const errText = await res.text();
          console.error('[Collections API] Directus PATCH failed status:', res.status, 'details:', errText);
        }
      } catch (err) {
        console.warn('[Collections API] Directus patch failed, falling back to local DB:', err);
      }
    }

    // Fallback to local file database
    const db = loadLocalDB();
    const commitment = db.commitments.find((c) => c.id === commitmentId);

    if (!commitment) {
      return NextResponse.json({ ok: false, message: 'Commitment not found' }, { status: 404 });
    }

    commitment.status = status;
    commitment.updatedAt = new Date().toISOString();
    if (status !== 'pending') {
      commitment.resolvedAt = new Date().toISOString();
    }

    if (noteText) {
      const newNote = {
        id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        commitmentId,
        invoiceNo: commitment.invoiceNo,
        noteType: status === 'kept' ? 'resolution' : 'escalation',
        noteText,
        createdBy: String(erpUserId),
        createdAt: new Date().toISOString(),
      };
      db.notes.push(newNote);
    }

    saveLocalDB(db);

    return NextResponse.json({ ok: true, commitment });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: 'Failed to update commitment', details: String(err) },
      { status: 500 }
    );
  }
}
