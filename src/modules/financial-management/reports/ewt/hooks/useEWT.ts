// hooks/useEWT.ts
// Encapsulates all data fetching, transformation, and state for the EWT module.
// The main component just calls this hook and receives clean, ready-to-use data.

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { transformEWTRows, aggregateByCustomer, deriveMetrics } from '../utils';
import type { EWTRecord, AggregatedEntry, EWTMetrics, RawEWTRow } from '../types';

interface UseEWTResult {
  loading: boolean;
  error: string | null;
  records: EWTRecord[];
  metrics: EWTMetrics;
  aggregated: AggregatedEntry[];
}

const EMPTY_METRICS: EWTMetrics = { totalAmount: 0, averageEwt: 0, totalRecords: 0 };

export function useEWT(): UseEWTResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<EWTRecord[]>([]);

  useEffect(() => {
    async function fetchData() {
      const toastId = toast.loading('Loading EWT data...');
      try {
        const res = await fetch('/api/fm/reports/ewt', { credentials: 'include' });
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Backend did not return JSON');
        }
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const result = await res.json();
        const rows: RawEWTRow[] = Array.isArray(result) ? result : (result.data || []);
        console.log('Raw EWT rows sample:', rows.slice(0, 3));
        setRecords(transformEWTRows(rows));
        setError(null);
        toast.success('EWT data loaded successfully', { id: toastId });
      } catch (e: any) {
        setError(e.message);
        toast.error(`Failed to load EWT data: ${e.message}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const metrics = useMemo(() => deriveMetrics(records), [records]);
  const aggregated = useMemo(() => aggregateByCustomer(records), [records]);

  return { loading, error, records, metrics, aggregated };
}