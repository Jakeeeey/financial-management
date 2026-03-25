// hooks/useAccountsPayable.ts
// Fetches ALL AP records with a wide date range; filtering is client-side.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  transformAPRows, buildAgingBuckets, buildSupplierData,
  buildStatusData, deriveMetrics,
} from '../utils';
import type {
  APRecord, AgingBucket, SupplierEntry, StatusEntry, APMetrics, RawAPRow,
} from '../types';

interface UseAPResult {
  loading:      boolean;
  error:        string | null;
  records:      APRecord[];
  agingData:    AgingBucket[];
  supplierData: SupplierEntry[];
  statusData:   StatusEntry[];
  metrics:      APMetrics;
}

export function useAccountsPayable(): UseAPResult {
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [records,      setRecords]      = useState<APRecord[]>([]);
  const [agingData,    setAgingData]    = useState<AgingBucket[]>([
    { range: '0–30 Days',  amount: 0 },
    { range: '31–60 Days', amount: 0 },
    { range: '61–90 Days', amount: 0 },
    { range: '91+ Days',   amount: 0 },
  ]);
  const [supplierData, setSupplierData] = useState<SupplierEntry[]>([]);
  const [statusData,   setStatusData]   = useState<StatusEntry[]>([]);
  const [metrics,      setMetrics]      = useState<APMetrics>({
    totalPayable: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0, totalRecords: 0,
  });

  useEffect(() => {
    async function fetchData() {
      const toastId = toast.loading('Loading accounts payable data...');
      try {
        const params = new URLSearchParams({
          startDate: '2020-01-01',
          endDate:   new Date().toISOString().split('T')[0],
        });

        const res = await fetch(
          `/api/fm/accounting/accounts-payable?${params}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Backend did not return JSON');
        }

        const result = await res.json();
        const rows: RawAPRow[] = Array.isArray(result)
          ? result
          : (result.data ?? result.content ?? result.transactions ?? []);

        const transformed  = transformAPRows(rows);
        setRecords(transformed);
        setAgingData(buildAgingBuckets(transformed));
        setSupplierData(buildSupplierData(transformed));
        setStatusData(buildStatusData(transformed));
        setMetrics(deriveMetrics(transformed));
        setError(null);
        toast.success('Data loaded successfully', { id: toastId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        toast.error(`Failed to load data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { loading, error, records, agingData, supplierData, statusData, metrics };
}