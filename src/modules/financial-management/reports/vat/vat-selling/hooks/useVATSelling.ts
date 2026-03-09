// hooks/useVATSelling.ts
// Encapsulates all fetching, transformation, and state for the VAT Selling module.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  transformTransactions,
  buildChartPoints,
  buildCustomerData,
  deriveMetrics,
} from '../utils';
import type {
  VATSaleTransaction,
  VATSaleChartPoint,
  VATCustomerEntry,
  VATSaleBarEntry,
  VATSaleMetrics,
} from '../types';

interface UseVATSellingResult {
  loading: boolean;
  error: string | null;
  transactions: VATSaleTransaction[];
  metrics: VATSaleMetrics;
  lineData: VATSaleChartPoint[];
  pieData: VATCustomerEntry[];
  barData: VATSaleBarEntry[];
}

const EMPTY_METRICS: VATSaleMetrics = { totalVat: 0, avgVat: 0, highestVat: 0, count: 0 };

export function useVATSelling(): UseVATSellingResult {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [transactions, setTransactions] = useState<VATSaleTransaction[]>([]);
  const [metrics, setMetrics]           = useState<VATSaleMetrics>(EMPTY_METRICS);
  const [lineData, setLineData]         = useState<VATSaleChartPoint[]>([]);
  const [pieData, setPieData]           = useState<VATCustomerEntry[]>([]);
  const [barData, setBarData]           = useState<VATSaleBarEntry[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      const toastId = toast.loading('Loading VAT Sales data...');
      try {
        // Pass a wide range so all historical records are returned from the backend
        const params = new URLSearchParams({
          startDate: '2020-01-01',
          endDate:   new Date().toISOString().split('T')[0],
        });

        const res = await fetch(`/api/fm/reports/vat/vat-selling?${params}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch VAT Selling data');
        const data = await res.json();

        const tx = Array.isArray(data.transactions) ? data.transactions : [];

        setTransactions(transformTransactions(tx));
        setMetrics(deriveMetrics(tx));
        setLineData(buildChartPoints(tx));

        const { pieData, barData } = buildCustomerData(tx);
        setPieData(pieData);
        setBarData(barData);

        toast.success('VAT Sales data loaded successfully', { id: toastId });
      } catch (err: any) {
        setError(err.message || 'Unknown error');
        toast.error(`Failed to load VAT Sales data: ${err.message || 'Unknown error'}`, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { loading, error, transactions, metrics, lineData, pieData, barData };
}