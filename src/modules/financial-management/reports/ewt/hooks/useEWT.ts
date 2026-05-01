// hooks/useEWT.ts
// Encapsulates all data fetching, transformation, and state for the EWT module.

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { transformEWTRows, buildPieData, buildTrendData, buildBarData } from '../utils';
import type { EWTRecord, PieEntry, TrendEntry, BarEntry, EWTMetrics, RawEWTRow } from '../types';

interface UseEWTResult {
  loading: boolean;
  error: string | null;
  records: EWTRecord[];
  metrics: EWTMetrics;
  pieData: PieEntry[];
  trendData: TrendEntry[];
  barData: BarEntry[];
}

export function useEWT(): UseEWTResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<EWTRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      const toastId = toast.loading('Loading EWT data...');
      try {
        // Pass a wide range so all historical records are returned from the backend
        const params = new URLSearchParams({
          startDate: '2020-01-01',
          endDate:   new Date().toISOString().split('T')[0],
        });

        const res = await fetch(`/api/fm/reports/cwt?${params}`, { credentials: 'include' });
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new TypeError('Backend returned HTML instead of JSON. Check the API path.');
        }
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const result = await res.json();
        const rawRows: RawEWTRow[] = Array.isArray(result)
          ? result
          : (result.data ?? result.transactions ?? result.content ?? []);

        setRecords(transformEWTRows(rawRows));
        setError(null);
        toast.success('EWT data loaded', { id: toastId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Failed to load EWT data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const metrics = useMemo<EWTMetrics>(() => ({
    totalAmount: records.reduce((acc, r) => acc + r.displayAmount, 0),
    totalTransactions: records.length,
  }), [records]);

  const pieData = useMemo(() => buildPieData(records), [records]);
  const trendData = useMemo(() => buildTrendData(records), [records]);
  const barData = useMemo(() => buildBarData(records), [records]);

  return { loading, error, records, metrics, pieData, trendData, barData };
}