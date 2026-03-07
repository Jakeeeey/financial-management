// hooks/useAccountsReceivable.ts
// Encapsulates all data fetching, loading, and error state for the AR module.
// The main component just calls this hook and gets clean, ready-to-use data.

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
} from '../types';

interface UseARResult {
  loading: boolean;
  error: string | null;
  invoices: Invoice[];
  agingData: AgingBucket[];
  branchData: NamedAmount[];
  salesmanData: NamedValue[];
  metrics: ARMetrics;
}

export function useAccountsReceivable(): UseARResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agingData, setAgingData] = useState<AgingBucket[]>([
    { range: '0-30 Days', amount: 0 },
    { range: '30-60 Days', amount: 0 },
    { range: '60+ Days', amount: 0 },
  ]);
  const [branchData, setBranchData] = useState<NamedAmount[]>([]);
  const [salesmanData, setSalesmanData] = useState<NamedValue[]>([]);
  const [metrics, setMetrics] = useState<ARMetrics>({
    totalReceivable: 0,
    totalOutstanding: 0,
    overdueInvoices: [],
    avgOverdue: 0,
  });

  useEffect(() => {
    async function fetchData() {
      const toastId = toast.loading('Loading accounts receivable data...');
      try {
        // credentials:'include' sends the httpOnly springboot_token cookie set by providers/fetchProvider.ts
        const res = await fetch('/api/fm/accounting/accounts-receivable', { credentials: 'include' });
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Backend did not return JSON');
        }
        const result = await res.json();
        const rows: RawInvoiceRow[] = Array.isArray(result) ? result : (result.data || []);

        const { invoices, agingData, branchMap, salesmanMap } = transformInvoices(rows);
        const metrics = deriveMetrics(invoices, branchMap);
        const branchData = mapToSortedArray(branchMap, 8);
        const salesmanData = Object.entries(salesmanMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);

        setInvoices(invoices);
        setAgingData(agingData);
        setBranchData(branchData);
        setSalesmanData(salesmanData);
        setMetrics(metrics);
        setError(null);
        toast.success('Data loaded successfully', { id: toastId });
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

  return { loading, error, invoices, agingData, branchData, salesmanData, metrics };
}