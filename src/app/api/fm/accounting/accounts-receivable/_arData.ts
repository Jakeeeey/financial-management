/**
 * Shared AR aggregation logic — used by the route handler with caching and view modes.
 */

export interface SalesInvoiceRow {
  invoice_id: number;
  invoice_no: string;
  order_id: string | null;
  customer_code: string | null;
  invoice_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  discount_amount: number | null;
  isPosted: unknown;
  sales_type: number | null;
  salesman_id: number | null;
  branch_id: { branch_name: string } | null;
  dispatch_date: string | null;
  payment_status: string | null;
  transaction_status: string | null;
}

export interface ARRow {
  invoiceId: number;
  invoiceNo: string;
  orderId: string;
  customerName: string;
  customerCode: string;
  invoiceDate: string | null;
  calculatedDueDate: string | null;
  dispatchDate: string | null;
  paymentStatus: string;
  transactionStatus: string;
  grossAmount: number;
  discountAmount: number;
  netReceivable: number;
  returnAmount: number;
  unfulfilledAmount: number;
  appliedCreditMemos: number;
  appliedDebitMemos: number;
  totalPaid: number;
  outstandingBalance: number;
  unpostedCollectionAmount: number;
  daysOverdue: number | null;
  branch: string;
  salesman: string;
  salesmanCode: string;
  division: string;
  salesType: number | null;
  isPosted: boolean;
  cluster: string;
}

export interface OperationBreakdown {
  id: number | null;
  name: string;
  code: string | null;
  totalOutstanding: number;
  count: number;
}

export interface AgingBucket {
  range: string;
  amount: number;
}

export interface SalesmanARData {
  name: string;
  value: number;
  unposted: number;
}

export interface ARMetricsSummary {
  totalReceivable: number;
  totalOutstanding: number;
  totalUnposted: number;
  realOutstanding: number;
  avgOverdue: number;
  overdueCount: number;
  invoiceCount: number;
  totalPendingCancellation: number;
  unpostedAllocationsActive: number;
  unpostedAllocationsPaid: number;
  unpostedUnallocated: number;
}

export interface ARFilterOptions {
  customers: string[];
  clusters: string[];
  salesmen: string[];
  divisions: string[];
  operations: { value: string; label: string }[];
}

export interface ARFullPayload {
  rows: ARRow[];
  operationData: OperationBreakdown[];
  agingData: AgingBucket[];
  salesmanData: SalesmanARData[];
  metrics: ARMetricsSummary;
  filterOptions: ARFilterOptions;
  totalUnpostedPool: number;
  unpostedAllocationsActive: number;
  unpostedAllocationsPaid: number;
  unpostedUnallocated: number;
  salesmanUnposted: Record<string, number>;
}

export interface ARTableFilters {
  dateFrom?: string;
  dateTo?: string;
  customer?: string;
  cluster?: string;
  salesman?: string;
  division?: string;
  operation?: string;
  agingRange?: string;
  search?: string;
}

export interface CustomerGroupRow {
  customerName: string;
  customerCode: string;
  netReceivable: number;
  totalPaid: number;
  outstanding: number;
  maxOverdue: number | null;
  invoices: ARRow[];
}

interface PaymentRow { invoice_id: number; paid_amount: number | null; }
interface ReturnRow { invoice_no: number; amount: number | null; }
interface MemoRow { invoice_id: number; amount: number | null; memo_id: { type: number | null; status: string | null } | null; }
interface UnfulfilledRow { sales_invoice_id: number; variance_amount: number | null; }
interface CustomerRow { customer_code: string; customer_name: string; province?: string | null; city?: string | null; brgy?: string | null; }
interface SalesmanRow { id: number; salesman_name: string; division_id: number | null; salesman_code?: string | null; }
interface DivisionRow { division_id: number; division_name: string; }
interface OperationRow { id: number; operation_name: string; operation_code: string | null; }
interface CollectionRow { id: number; salesman_id: number | null; totalAmount: number | null; }
interface CollectionInvoiceRow { collection_id: number; invoice_id: number; amount: number; }
interface AreaRow { id: number; cluster_id: number; province: string | null; city: string | null; baranggay: string | null; }
export type { AreaRow };

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '');
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || '').trim();

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
  const chunks: (number | string)[][] = [];
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

function norm(s: string | null | undefined): string {
  return s?.trim().toUpperCase() || '';
}

const PROVINCE_AGNOSTIC_AREA_KEY = '__ANY__';

export type AreaIndex = Map<string, AreaRow[]>;

export function buildAreaIndex(areas: AreaRow[]): AreaIndex {
  const index: AreaIndex = new Map();
  for (const area of areas) {
    const key = norm(area.province) || PROVINCE_AGNOSTIC_AREA_KEY;
    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push(area);
  }
  return index;
}

export function getAreaCandidates(provinceKey: string, areaIndex: AreaIndex): AreaRow[] {
  return [
    ...(areaIndex.get(provinceKey) ?? []),
    ...(areaIndex.get(PROVINCE_AGNOSTIC_AREA_KEY) ?? []),
  ];
}

export function findClusterForCustomer(
  prov: string | null | undefined,
  cit: string | null | undefined,
  brg: string | null | undefined,
  areaIndex: AreaIndex,
): number | null {
  const p = norm(prov);
  const c = norm(cit);
  const b = norm(brg);
  if (!p) return null;

  const candidates = getAreaCandidates(p, areaIndex);

  let bestMatch: { cluster_id: number; score: number } | null = null;
  for (const area of candidates) {
    const ap = norm(area.province);
    const ac = norm(area.city);
    const ab = norm(area.baranggay);
    if (ap && ap !== p) continue;

    let score = 0;
    if (ap) score += 1;
    if (ac) {
      if (ac !== c) continue;
      score += 2;
    }
    if (ab) {
      if (ab !== b) continue;
      score += 4;
    }
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { cluster_id: area.cluster_id, score };
    }
  }
  return bestMatch ? bestMatch.cluster_id : null;
}

function deriveAgingData(rows: ARRow[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: '0-30 Days', amount: 0 },
    { range: '31-60 Days', amount: 0 },
    { range: '61-90 Days', amount: 0 },
    { range: '90+ Days', amount: 0 },
  ];
  for (const row of rows) {
    const aging = row.daysOverdue;
    if (aging === null || aging < 0 || row.outstandingBalance <= 0) continue;
    if (aging <= 30) buckets[0].amount += row.outstandingBalance;
    else if (aging <= 60) buckets[1].amount += row.outstandingBalance;
    else if (aging <= 90) buckets[2].amount += row.outstandingBalance;
    else buckets[3].amount += row.outstandingBalance;
  }
  return buckets;
}

export interface ScopedUnpostedMetrics {
  totalUnposted: number;
  realOutstanding: number;
  unpostedAllocationsActive: number;
  unpostedAllocationsPaid: number;
  unpostedUnallocated: number;
  totalUnpostedPool: number;
}

/** Sum unposted allocations on the given rows only (for filtered AR views). */
export function deriveScopedUnpostedMetrics(rows: ARRow[]): ScopedUnpostedMetrics {
  const totalOutstanding = rows.reduce((s, r) => s + r.outstandingBalance, 0);
  const scopedActiveAllocations = rows.reduce((s, r) => s + (r.unpostedCollectionAmount || 0), 0);
  return {
    totalUnposted: scopedActiveAllocations,
    realOutstanding: Math.max(0, totalOutstanding - scopedActiveAllocations),
    unpostedAllocationsActive: scopedActiveAllocations,
    unpostedAllocationsPaid: 0,
    unpostedUnallocated: 0,
    totalUnpostedPool: scopedActiveAllocations,
  };
}

function deriveMetricsFromRows(
  rows: ARRow[],
  pool: {
    totalUnpostedPool: number;
    unpostedAllocationsActive: number;
    unpostedAllocationsPaid: number;
    unpostedUnallocated: number;
  }
): ARMetricsSummary {
  const totalReceivable = rows.reduce((s, r) => s + r.netReceivable, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstandingBalance, 0);
  const overdue = rows.filter(r => r.daysOverdue !== null && r.daysOverdue >= 0 && r.outstandingBalance > 0);
  const totalPendingCancellation = rows
    .filter(r => r.transactionStatus === 'Cancellation Requested')
    .reduce((sum, row) => sum + row.outstandingBalance, 0);
  const avgOverdue = overdue.length > 0
    ? Math.round(overdue.reduce((s, r) => s + (r.daysOverdue ?? 0), 0) / overdue.length)
    : 0;

  return {
    totalReceivable,
    totalOutstanding,
    totalUnposted: pool.totalUnpostedPool,
    realOutstanding: Math.max(0, totalOutstanding - pool.totalUnpostedPool),
    avgOverdue,
    overdueCount: overdue.length,
    invoiceCount: rows.length,
    totalPendingCancellation,
    unpostedAllocationsActive: pool.unpostedAllocationsActive,
    unpostedAllocationsPaid: pool.unpostedAllocationsPaid,
    unpostedUnallocated: pool.unpostedUnallocated,
  };
}

function buildFilterOptions(rows: ARRow[], operationData: OperationBreakdown[]): ARFilterOptions {
  return {
    customers: Array.from(new Set(rows.map(r => r.customerName))).sort(),
    clusters: Array.from(new Set(rows.map(r => r.cluster).filter(c => c && c !== 'Unassigned'))).sort(),
    salesmen: Array.from(new Set(rows.map(r => r.salesman).filter(s => s && s !== 'Unknown'))).sort(),
    divisions: Array.from(new Set(rows.map(r => r.division).filter(d => d && d !== '—'))).sort(),
    operations: operationData.map(op => ({ value: String(op.id), label: op.name })),
  };
}

function buildSalesmanData(rows: ARRow[], salesmanUnposted: Record<string, number>): SalesmanARData[] {
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.salesman] = (map[row.salesman] || 0) + row.outstandingBalance;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, unposted: Number(salesmanUnposted[name] || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function applyARFilters(rows: ARRow[], filters: ARTableFilters): ARRow[] {
  const q = (filters.search || '').trim().toLowerCase();
  return rows.filter((row) => {
    const invDate = row.invoiceDate ? row.invoiceDate.split(' ')[0] : '';
    if (filters.dateFrom && invDate && invDate < filters.dateFrom) return false;
    if (filters.dateTo && invDate && invDate > filters.dateTo) return false;
    if (filters.customer && row.customerName !== filters.customer) return false;
    if (filters.cluster && row.cluster !== filters.cluster) return false;
    if (filters.salesman && row.salesman !== filters.salesman) return false;
    if (filters.division && row.division !== filters.division) return false;
    if (filters.operation && String(row.salesType) !== String(filters.operation)) return false;
    if (filters.agingRange) {
      const overdueDays = row.daysOverdue;
      if (overdueDays === null || overdueDays < 0) return false;
      if (filters.agingRange === '0-30 Days' && overdueDays > 30) return false;
      if (filters.agingRange === '31-60 Days' && (overdueDays <= 30 || overdueDays > 60)) return false;
      if (filters.agingRange === '61-90 Days' && (overdueDays <= 60 || overdueDays > 90)) return false;
      if (filters.agingRange === '90+ Days' && overdueDays <= 90) return false;
    }
    if (q) {
      const match =
        row.invoiceNo.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.salesman.toLowerCase().includes(q) ||
        row.division.toLowerCase().includes(q) ||
        row.customerCode.toLowerCase().includes(q) ||
        (row.invoiceDate || '').toLowerCase().includes(q) ||
        (row.dispatchDate || '').toLowerCase().includes(q) ||
        (row.calculatedDueDate || '').toLowerCase().includes(q) ||
        row.paymentStatus.toLowerCase().includes(q) ||
        row.transactionStatus.toLowerCase().includes(q) ||
        row.cluster.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

export function buildCustomerGroups(rows: ARRow[]): CustomerGroupRow[] {
  const groupsMap = new Map<string, ARRow[]>();
  for (const row of rows) {
    const name = row.customerName || '—';
    if (!groupsMap.has(name)) groupsMap.set(name, []);
    groupsMap.get(name)!.push(row);
  }

  const groups: CustomerGroupRow[] = [];
  for (const [name, invs] of groupsMap) {
    let maxOverdue: number | null = null;
    for (const inv of invs) {
      if (inv.daysOverdue !== null && inv.daysOverdue >= 0) {
        if (maxOverdue === null || inv.daysOverdue > maxOverdue) maxOverdue = inv.daysOverdue;
      }
    }
    groups.push({
      customerName: name,
      customerCode: invs[0]?.customerCode || '—',
      netReceivable: invs.reduce((s, i) => s + i.netReceivable, 0),
      totalPaid: invs.reduce((s, i) => s + i.totalPaid, 0),
      outstanding: invs.reduce((s, i) => s + i.outstandingBalance, 0),
      maxOverdue,
      invoices: invs,
    });
  }
  return groups;
}

export async function fetchARFullPayload(): Promise<ARFullPayload> {
  if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) {
    throw new Error('Server misconfigured');
  }

  const invoiceFields = [
    'invoice_id', 'invoice_no', 'order_id', 'customer_code',
    'invoice_date', 'due_date', 'gross_amount', 'discount_amount',
    'isPosted', 'sales_type', 'salesman_id', 'branch_id.branch_name',
    'dispatch_date', 'payment_status', 'transaction_status',
  ].join(',');

  const invoiceFilter =
    `filter[payment_status][_nin]=Paid,Fully Paid` +
    `&filter[_or][0][isPosted][_null]=true` +
    `&filter[_or][1][isPosted][_eq]=false`;

  const invoiceUrl =
    `${DIRECTUS_URL}/items/sales_invoice?limit=-1&fields=${invoiceFields}&${invoiceFilter}`;
  const collectionUrl =
    `${DIRECTUS_URL}/items/collection?limit=-1&fields=id,salesman_id,totalAmount&filter[isPosted][_neq]=true&filter[isCancelled][_neq]=true`;

  const [invoices, unpostedCollections] = await Promise.all([
    fetchAll<SalesInvoiceRow>(invoiceUrl),
    fetchAll<CollectionRow>(collectionUrl).catch(() => [] as CollectionRow[]),
  ]);

  if (invoices.length === 0) {
    const emptyPool = { totalUnpostedPool: 0, unpostedAllocationsActive: 0, unpostedAllocationsPaid: 0, unpostedUnallocated: 0 };
    return {
      rows: [],
      operationData: [],
      agingData: deriveAgingData([]),
      salesmanData: [],
      metrics: deriveMetricsFromRows([], emptyPool),
      filterOptions: { customers: [], clusters: [], salesmen: [], divisions: [], operations: [] },
      salesmanUnposted: {},
      ...emptyPool,
    };
  }

  const invoiceIds = invoices.map(inv => inv.invoice_id);
  const customerCodes = Array.from(
    new Set(invoices.map(inv => inv.customer_code).filter((c): c is string => !!c))
  );
  const salesmanIds = Array.from(
    new Set(invoices.map(inv => inv.salesman_id).filter((s): s is number => typeof s === 'number'))
  );
  const salesTypeIds = Array.from(
    new Set(invoices.map(inv => inv.sales_type).filter((s): s is number => typeof s === 'number'))
  );
  const unpostedPouchIds = unpostedCollections.map(c => c.id);

  const [
    payments,
    returns_,
    memos,
    unfulfilled,
    customers,
    salesmen,
    operations,
    unpostedInvoiceAllocs,
    clusters,
    areas,
  ] = await Promise.all([
    fetchAllChunked<PaymentRow>(
      `${DIRECTUS_URL}/items/sales_invoice_payments?limit=-1&fields=invoice_id,paid_amount`,
      'invoice_id', invoiceIds
    ),
    fetchAllChunked<ReturnRow>(
      `${DIRECTUS_URL}/items/sales_invoice_sales_return?limit=-1&fields=invoice_no,amount`,
      'invoice_no', invoiceIds
    ),
    fetchAllChunked<MemoRow>(
      `${DIRECTUS_URL}/items/customer_memo_invoices?limit=-1&fields=invoice_id,amount,memo_id.type,memo_id.status`,
      'invoice_id', invoiceIds
    ),
    fetchAllChunked<UnfulfilledRow>(
      `${DIRECTUS_URL}/items/unfulfilled_sales_transaction?limit=-1&fields=sales_invoice_id,variance_amount`,
      'sales_invoice_id', invoiceIds
    ),
    fetchAllChunked<CustomerRow>(
      `${DIRECTUS_URL}/items/customer?limit=-1&fields=customer_code,customer_name,province,city,brgy`,
      'customer_code', customerCodes
    ),
    fetchAllChunked<SalesmanRow>(
      `${DIRECTUS_URL}/items/salesman?limit=-1&fields=id,salesman_name,division_id,salesman_code`,
      'id', salesmanIds
    ),
    salesTypeIds.length > 0
      ? fetchAllChunked<OperationRow>(
          `${DIRECTUS_URL}/items/operation?limit=-1&fields=id,operation_name,operation_code`,
          'id', salesTypeIds
        )
      : Promise.resolve([] as OperationRow[]),
    fetchAllChunked<CollectionInvoiceRow>(
      `${DIRECTUS_URL}/items/collection_invoices?limit=-1&fields=collection_id,invoice_id,amount`,
      'collection_id', unpostedPouchIds
    ).catch(() => [] as CollectionInvoiceRow[]),
    fetchAll<{ id: number; cluster_name: string }>(
      `${DIRECTUS_URL}/items/cluster?limit=-1&fields=id,cluster_name`
    ).catch(() => []),
    fetchAll<AreaRow>(
      `${DIRECTUS_URL}/items/area_per_cluster?limit=-1&fields=id,cluster_id,province,city,baranggay`
    ).catch(() => []),
  ]);

  const divisionIds = Array.from(
    new Set(salesmen.map((s) => s.division_id).filter((d): d is number => typeof d === 'number'))
  );
  const divisions = divisionIds.length > 0
    ? await fetchAllChunked<DivisionRow>(
        `${DIRECTUS_URL}/items/division?limit=-1&fields=division_id,division_name`,
        'division_id',
        divisionIds
      )
    : [];

  const customerMap = new Map(customers.map(c => [c.customer_code, c.customer_name]));
  const divisionMap = new Map(divisions.map(d => [d.division_id, d.division_name]));
  const salesmanMap = new Map(
    salesmen.map(s => [s.id, {
      name: s.salesman_name,
      division: s.division_id ? (divisionMap.get(s.division_id) || '—') : '—',
      code: s.salesman_code || '—',
    }])
  );
  const operationMap = new Map(operations.map(op => [op.id, { name: op.operation_name, code: op.operation_code }]));
  const clusterNameMap = new Map(clusters.map(cl => [cl.id, cl.cluster_name]));
  const areaIndex = buildAreaIndex(areas);

  const customerClusterMap = new Map<string, string>();
  for (const cust of customers) {
    const cId = findClusterForCustomer(cust.province, cust.city, cust.brgy, areaIndex);
    customerClusterMap.set(cust.customer_code, cId ? (clusterNameMap.get(cId) || 'Unassigned') : 'Unassigned');
  }

  const paymentAgg = new Map<number, number>();
  for (const p of payments) paymentAgg.set(p.invoice_id, (paymentAgg.get(p.invoice_id) || 0) + (Number(p.paid_amount) || 0));

  const returnAgg = new Map<number, number>();
  for (const r of returns_) returnAgg.set(r.invoice_no, (returnAgg.get(r.invoice_no) || 0) + (Number(r.amount) || 0));

  const creditAgg = new Map<number, number>();
  const debitAgg = new Map<number, number>();
  for (const m of memos) {
    if (!m.memo_id || m.memo_id.status !== 'APPROVED') continue;
    const type = Number(m.memo_id.type);
    const amt = Number(m.amount) || 0;
    if (type === 1) creditAgg.set(m.invoice_id, (creditAgg.get(m.invoice_id) || 0) + amt);
    else if (type === 0 || type === 2) debitAgg.set(m.invoice_id, (debitAgg.get(m.invoice_id) || 0) + amt);
  }

  const unfulfilledAgg = new Map<number, number>();
  for (const u of unfulfilled) {
    unfulfilledAgg.set(u.sales_invoice_id, (unfulfilledAgg.get(u.sales_invoice_id) || 0) + (Number(u.variance_amount) || 0));
  }

  const unpostedAgg = new Map<number, number>();
  for (const alloc of unpostedInvoiceAllocs) {
    unpostedAgg.set(alloc.invoice_id, (unpostedAgg.get(alloc.invoice_id) || 0) + (Number(alloc.amount) || 0));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: ARRow[] = [];
  for (const inv of invoices) {
    if (parseBit(inv.isPosted)) continue;
    if ((inv.transaction_status || '').trim().toUpperCase() === 'CANCELLED') continue;

    const grossAmount = Number(inv.gross_amount) || 0;
    const discountAmount = Number(inv.discount_amount) || 0;
    const netReceivable = grossAmount - discountAmount;
    const returnAmount = returnAgg.get(inv.invoice_id) || 0;
    const creditMemos = creditAgg.get(inv.invoice_id) || 0;
    const debitMemos = debitAgg.get(inv.invoice_id) || 0;
    const unfulfilledAmount = unfulfilledAgg.get(inv.invoice_id) || 0;
    const totalPaid = paymentAgg.get(inv.invoice_id) || 0;
    const outstandingBalance = Math.max(0, netReceivable - returnAmount - creditMemos + debitMemos - unfulfilledAmount - totalPaid);
    if (outstandingBalance <= 0) continue;

    let daysOverdue: number | null = null;
    if (inv.due_date) {
      const due = new Date(inv.due_date);
      if (!isNaN(due.getTime())) {
        due.setHours(0, 0, 0, 0);
        daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const sm = inv.salesman_id ? salesmanMap.get(inv.salesman_id) : null;
    rows.push({
      invoiceId: inv.invoice_id,
      invoiceNo: inv.invoice_no,
      orderId: inv.order_id || '',
      customerName: customerMap.get(inv.customer_code || '') || inv.customer_code || '—',
      customerCode: inv.customer_code || '',
      invoiceDate: inv.invoice_date,
      calculatedDueDate: inv.due_date,
      dispatchDate: inv.dispatch_date,
      paymentStatus: inv.payment_status || 'Unpaid',
      transactionStatus: inv.transaction_status || 'NULL',
      grossAmount,
      discountAmount,
      netReceivable,
      returnAmount,
      unfulfilledAmount,
      appliedCreditMemos: creditMemos,
      appliedDebitMemos: debitMemos,
      totalPaid,
      outstandingBalance,
      unpostedCollectionAmount: unpostedAgg.get(inv.invoice_id) || 0,
      daysOverdue,
      branch: inv.branch_id?.branch_name || 'Unknown',
      salesman: sm?.name || 'Unknown',
      salesmanCode: sm?.code || '—',
      division: sm?.division || '—',
      salesType: inv.sales_type ?? null,
      isPosted: false,
      cluster: customerClusterMap.get(inv.customer_code || '') || 'Unassigned',
    });
  }

  const operationAgg = new Map<number | string, OperationBreakdown>();
  for (const row of rows) {
    const key = row.salesType ?? '__unknown__';
    if (!operationAgg.has(key)) {
      const op = typeof key === 'number' ? operationMap.get(key) : null;
      operationAgg.set(key, {
        id: key === '__unknown__' ? null : (key as number),
        name: op?.name ?? 'Unknown',
        code: op?.code ?? null,
        totalOutstanding: 0,
        count: 0,
      });
    }
    const entry = operationAgg.get(key)!;
    entry.totalOutstanding += row.outstandingBalance;
    entry.count += 1;
  }

  const operationData = Array.from(operationAgg.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  const totalUnpostedPool = unpostedCollections.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
  const activeInvoiceIds = new Set(invoices.map(i => i.invoice_id));
  let unpostedAllocationsActive = 0;
  let unpostedAllocationsPaid = 0;
  for (const alloc of unpostedInvoiceAllocs) {
    if (activeInvoiceIds.has(alloc.invoice_id)) unpostedAllocationsActive += Number(alloc.amount) || 0;
    else unpostedAllocationsPaid += Number(alloc.amount) || 0;
  }
  const unpostedUnallocated = Math.max(0, totalUnpostedPool - (unpostedAllocationsActive + unpostedAllocationsPaid));

  const salesmanUnposted: Record<string, number> = {};
  for (const c of unpostedCollections) {
    if (c.salesman_id) {
      const sm = salesmanMap.get(c.salesman_id);
      const name = sm?.name || `Salesman #${c.salesman_id}`;
      salesmanUnposted[name] = (salesmanUnposted[name] || 0) + (Number(c.totalAmount) || 0);
    }
  }

  const pool = { totalUnpostedPool, unpostedAllocationsActive, unpostedAllocationsPaid, unpostedUnallocated };

  return {
    rows,
    operationData,
    agingData: deriveAgingData(rows),
    salesmanData: buildSalesmanData(rows, salesmanUnposted),
    metrics: deriveMetricsFromRows(rows, pool),
    filterOptions: buildFilterOptions(rows, operationData),
    salesmanUnposted,
    ...pool,
  };
}

// ── In-memory cache (60s TTL) ────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000;
const payloadCache = new Map<string, { payload: ARFullPayload; expires: number }>();
const payloadInFlight = new Map<string, Promise<ARFullPayload>>();

export function getCachedARPayload(cacheKey: string): ARFullPayload | null {
  const entry = payloadCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    payloadCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

export function setCachedARPayload(cacheKey: string, payload: ARFullPayload): void {
  payloadCache.set(cacheKey, { payload, expires: Date.now() + CACHE_TTL_MS });
}

export async function getARPayload(cacheKey: string): Promise<ARFullPayload> {
  const cached = getCachedARPayload(cacheKey);
  if (cached) return cached;

  const pending = payloadInFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const payload = await fetchARFullPayload();
    setCachedARPayload(cacheKey, payload);
    return payload;
  })();

  payloadInFlight.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    payloadInFlight.delete(cacheKey);
  }
}
