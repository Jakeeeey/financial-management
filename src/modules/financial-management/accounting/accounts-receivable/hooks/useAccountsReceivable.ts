import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { transformInvoices, deriveMetrics, mapToSortedArray } from '../utils';
import type {
  Invoice,
  AgingBucket,
  NamedAmount,
  NamedValue,
  ARMetrics,
  RawInvoiceRow,
  OperationBreakdown,
  ARApiResponse,
} from '../types';

interface UseARResult {
  loading: boolean;
  error: string | null;
  invoices: Invoice[];
  agingData: AgingBucket[];
  salesmanData: NamedValue[];
  customerData: NamedAmount[];
  metrics: ARMetrics;
  operationData: OperationBreakdown[];
}

export function useAccountsReceivable(): UseARResult {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [agingData, setAgingData]       = useState<AgingBucket[]>([
    { range: '0-30 Days',  amount: 0 },
    { range: '31-60 Days', amount: 0 },
    { range: '61-90 Days', amount: 0 },
    { range: '90+ Days',   amount: 0 },
  ]);
  const [salesmanData, setSalesmanData] = useState<NamedValue[]>([]);
  const [customerData, setCustomerData] = useState<NamedAmount[]>([]);
  const [operationData, setOperationData] = useState<OperationBreakdown[]>([]);
  const [metrics, setMetrics]           = useState<ARMetrics>({
    totalReceivable: 0,
    totalOutstanding: 0,
    overdueInvoices: [],
    avgOverdue: 0,
  });

  useEffect(() => {
    async function fetchData() {
      const toastId = toast.loading('Loading accounts receivable…');
      try {
        // No date params — the API filters by isPosted=false and payment_status≠Paid
        const res = await fetch('/api/fm/accounting/accounts-receivable', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Backend did not return JSON');
        }

        const result: ARApiResponse = await res.json();
        const rows: RawInvoiceRow[] = Array.isArray(result)
          ? result
          : (result.rows ?? (result as unknown as { data?: RawInvoiceRow[] }).data ?? []);
        const opData = Array.isArray(result) ? [] : (result.operationData ?? []);

        const { invoices, agingData, salesmanMap, customerMap } = transformInvoices(rows);
        const metrics      = deriveMetrics(invoices);
        const customerData = mapToSortedArray(customerMap, 10);
        const salesmanData = Object.entries(salesmanMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);

        setInvoices(invoices);
        setAgingData(agingData);
        setSalesmanData(salesmanData);
        setCustomerData(customerData);
        setOperationData(opData);
        setMetrics(metrics);
        setError(null);
        toast.success(`Loaded ${invoices.length} invoices`, { id: toastId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Failed to load data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { loading, error, invoices, agingData, salesmanData, customerData, metrics, operationData };
}