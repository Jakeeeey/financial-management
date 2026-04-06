// tax-calendar/hooks/useTaxCalendar.ts
import { useEffect, useState, useCallback } from 'react';
import type { TaxActivity, TaxActivityForm } from '../types';

interface UseTaxCalendarResult {
  loading:    boolean;
  error:      string | null;
  activities: TaxActivity[];
  refetch:    () => void;
  create:     (form: TaxActivityForm) => Promise<boolean>;
  update:     (id: string, form: TaxActivityForm) => Promise<boolean>;
}

export function useTaxCalendar(): UseTaxCalendarResult {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [activities, setActivities] = useState<TaxActivity[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fm/reports/tax-calendar', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tax activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = async (form: TaxActivityForm): Promise<boolean> => {
    try {
      const res = await fetch('/api/fm/reports/tax-calendar', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await fetchData();
      return true;
    } catch { return false; }
  };

  const update = async (id: string, form: TaxActivityForm): Promise<boolean> => {
    try {
      const res = await fetch(`/api/fm/reports/tax-calendar/${id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await fetchData();
      return true;
    } catch { return false; }
  };

  return { loading, error, activities, refetch: fetchData, create, update };
}