// useCollectionsWorklist.ts
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ARCollectionCommitment, CollectionsMergedRow } from '../types';

export function useCollectionsWorklist(filters: {
  salesman?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<ARCollectionCommitment[]>([]);
  const [mergedRows, setMergedRows] = useState<CollectionsMergedRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [salesmenOptions, setSalesmenOptions] = useState<string[]>([]);
  const [stats, setStats] = useState<{
    totalOutstanding: number;
    totalCommitted: number;
    brokenCount: number;
    pendingCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCollectionsData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('view', 'worklist');
      params.set('page', String(filters.page || 1));
      params.set('pageSize', String(filters.pageSize || 10));
      if (filters.salesman && filters.salesman !== 'all') params.set('salesman', filters.salesman);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/fm/accounting/ar-collections?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load collections: ${res.statusText}`);
      }
      const data = await res.json();
      setCommitments(data.commitments || []);
      setMergedRows(data.mergedRows || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
      setStats(data.stats || null);
      if (data.filterOptions?.salesmen) {
        setSalesmenOptions(data.filterOptions.salesmen);
      }
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(`Error loading collections data: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.pageSize, filters.salesman, filters.status, filters.search]);

  useEffect(() => {
    fetchCollectionsData();
  }, [fetchCollectionsData]);

  return {
    loading,
    error,
    commitments,
    mergedRows,
    totalPages,
    totalCount,
    stats,
    filterOptions: {
      salesmen: salesmenOptions,
    },
    refresh: fetchCollectionsData,
  };
}
