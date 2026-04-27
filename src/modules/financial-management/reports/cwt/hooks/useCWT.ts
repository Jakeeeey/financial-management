// hooks/useCWT.ts
// Encapsulates all data fetching, transformation, and state for the CWT module.
// The main component just calls this hook and receives clean, ready-to-use data.

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { transformCWTRows, aggregateByCustomer, deriveMetrics } from '../utils';
import type { CWTRecord, AggregatedEntry, CWTMetrics, RawCWTRow } from '../types';

interface UseCWTResult {
  loading: boolean;
  error: string | null;
  records: CWTRecord[];
  metrics: CWTMetrics;
  aggregated: AggregatedEntry[];
}

// const EMPTY_METRICS: CWTMetrics = { totalAmount: 0, averageCwt: 0, totalRecords: 0 };

export function useCWT(): UseCWTResult {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [records, setRecords] = useState<CWTRecord[]>([]);

  useEffect(() => {
    async function fetchData() {
      const toastId = toast.loading('Loading CWT data...');
      try {
        // Pass a wide range so all historical records are returned from the backend
        const params = new URLSearchParams({
          startDate: '2020-01-01',
          endDate:   new Date().toISOString().split('T')[0],
        });

        const res = await fetch(`/api/fm/reports/ewt?${params}`, { credentials: 'include' });
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Backend did not return JSON');
        }
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const result = await res.json();
        const rows: RawCWTRow[] = Array.isArray(result)
          ? result
          : (result.data ?? result.transactions ?? result.content ?? []);

        setRecords(transformCWTRows(rows));
        setError(null);
        toast.success('CWT data loaded successfully', { id: toastId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Failed to load CWT data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const metrics    = useMemo(() => deriveMetrics(records),        [records]);
  const aggregated = useMemo(() => aggregateByCustomer(records),  [records]);

  return { loading, error, records, metrics, aggregated };
}