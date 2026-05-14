// tax-calendar/hooks/useTaxCalendar.ts
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
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
    const toastId = toast.loading('Loading tax calendar data...');
    try {
      const res = await fetch('/api/fm/reports/tax-calendar', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : (data.data ?? []));
      toast.success('Tax calendar data loaded successfully', { id: toastId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tax activities';
      setError(msg);
      toast.error(`Failed to load: ${msg}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = async (form: TaxActivityForm): Promise<boolean> => {
    const toastId = toast.loading('Creating tax activity...');
    try {
      const res = await fetch('/api/fm/reports/tax-calendar', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await fetchData();
      toast.success('Tax activity created successfully', { id: toastId });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create';
      toast.error(`Failed to create: ${msg}`, { id: toastId });
      return false;
    }
  };

  const update = async (id: string, form: TaxActivityForm): Promise<boolean> => {
    const toastId = toast.loading('Updating tax activity...');
    try {
      const res = await fetch(`/api/fm/reports/tax-calendar/${id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await fetchData();
      toast.success('Tax activity updated successfully', { id: toastId });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update';
      toast.error(`Failed to update: ${msg}`, { id: toastId });
      return false;
    }
  };

  return { loading, error, activities, refetch: fetchData, create, update };
}