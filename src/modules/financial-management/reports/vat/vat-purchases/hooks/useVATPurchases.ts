// hooks/useVATPurchases.ts
// Encapsulates all fetching, transformation, and state for the VAT Purchases module.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  transformTransactions,
  buildChartPoints,
  buildSupplierData,
  deriveMetrics,
} from '../utils';
import type {
  VATTransaction,
  VATChartPoint,
  VATSupplierEntry,
  VATBarEntry,
  VATMetrics,
} from '../types';

interface UseVATPurchasesResult {
  loading: boolean;
  error: string | null;
  transactions: VATTransaction[];
  metrics: VATMetrics;
  lineData: VATChartPoint[];
  pieData: VATSupplierEntry[];
  barData: VATBarEntry[];
}

const EMPTY_METRICS: VATMetrics = { totalVat: 0, avgVat: 0, highestVat: 0, count: 0 };

export function useVATPurchases(): UseVATPurchasesResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<VATTransaction[]>([]);
  const [metrics, setMetrics] = useState<VATMetrics>(EMPTY_METRICS);
  const [lineData, setLineData] = useState<VATChartPoint[]>([]);
  const [pieData, setPieData] = useState<VATSupplierEntry[]>([]);
  const [barData, setBarData] = useState<VATBarEntry[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      const toastId = toast.loading('Loading VAT Purchases data...');
      try {
        const res = await fetch('/api/fm/reports/vat/vat-purchases', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch VAT Purchases data');
        const data = await res.json();

        // API returns a plain array — handle all possible shapes robustly
        let tx: import('../types').RawVATTransaction[] = [];
        if (Array.isArray(data)) {
          tx = data;
        } else if (Array.isArray(data.transactions)) {
          tx = data.transactions;
        } else if (Array.isArray(data.data)) {
          tx = data.data;
        } else if (Array.isArray(data.content)) {
          tx = data.content;
        } else {
          const arrProp = Object.values(data).find(v => Array.isArray(v));
          if (arrProp) tx = arrProp as import('../types').RawVATTransaction[];
        }

        setTransactions(transformTransactions(tx));
        setMetrics(deriveMetrics(tx));
        setLineData(buildChartPoints(tx));

        const { pieData, barData } = buildSupplierData(tx);
        setPieData(pieData);
        setBarData(barData);

        toast.success('VAT Purchases data loaded successfully', { id: toastId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        toast.error(`Failed to load VAT data: ${msg}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { loading, error, transactions, metrics, lineData, pieData, barData };
}