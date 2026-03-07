// hooks/useCWT.ts
// Encapsulates all data fetching, transformation, and state for the CWT module.

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { transformCWTRows, buildPieData, buildTrendData, buildBarData } from '../utils';
import type { CWTRecord, PieEntry, TrendEntry, BarEntry, CWTMetrics, RawCWTRow } from '../types';

interface UseCWTResult {
  loading: boolean;
  error: string | null;
  records: CWTRecord[];
  metrics: CWTMetrics;
  pieData: PieEntry[];
  trendData: TrendEntry[];
  barData: BarEntry[];
}

export function useCWT(): UseCWTResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<CWTRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      const toastId = toast.loading('Loading CWT data...');
      try {
        const res = await fetch('/api/fm/reports/cwt', { credentials: 'include' });
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new TypeError('Backend returned HTML instead of JSON. Check the API path.');
        }
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const result = await res.json();
        // Support top-level array or wrapped { data: [] } / { transactions: [] }
        const rawRows: RawCWTRow[] = Array.isArray(result)
          ? result
          : (result.data ?? result.transactions ?? result.content ?? []);

        setRecords(transformCWTRows(rawRows));
        setError(null);
        toast.success('CWT data loaded', { id: toastId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Failed to load CWT data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const metrics = useMemo<CWTMetrics>(() => ({
    totalAmount: records.reduce((acc, r) => acc + r.displayAmount, 0),
    totalTransactions: records.length,
  }), [records]);

  const pieData = useMemo(() => buildPieData(records), [records]);
  const trendData = useMemo(() => buildTrendData(records), [records]);
  const barData = useMemo(() => buildBarData(records), [records]);

  return { loading, error, records, metrics, pieData, trendData, barData };
}