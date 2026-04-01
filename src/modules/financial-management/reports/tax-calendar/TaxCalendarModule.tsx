"use client";

// tax-calendar/TaxCalendarModule.tsx
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, AlertCircle } from 'lucide-react';

import { useTaxCalendar }    from './hooks/useTaxCalendar';
import { TaxMetricCards }    from './components/MetricCard';
import { UpcomingBanner }    from './components/UpComing';
import { TaxFormDialog }     from './components/TaxFormDialog';
import { TaxTable }          from './components/TaxTable';
import { TaxCalendarView }   from './components/TaxCalendar';
import { deriveMetrics, getUpcoming, applyFilters } from './utils';
import { STATUSES, EMPTY_FORM } from './types';
import type { TaxActivity, TaxActivityForm } from './types';

export default function TaxCalendarModule() {
  const { loading, error, activities, refetch, create, update } = useTaxCalendar();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [addOpen,      setAddOpen]      = useState(false);
  const [editItem,     setEditItem]     = useState<TaxActivity | null>(null);
  const [saving,       setSaving]       = useState(false);

  const isFiltered = !!(search || statusFilter !== 'All' || typeFilter !== 'All');

  // Filtered by status and type only (for calendar and metrics)
  const filteredByCategory = useMemo(
    () => applyFilters(activities, '', statusFilter, typeFilter),
    [activities, statusFilter, typeFilter]
  );

  // Fully filtered including search (for table only)
  const filtered   = useMemo(
    () => applyFilters(activities, search, statusFilter, typeFilter),
    [activities, search, statusFilter, typeFilter]
  );

  const metrics    = useMemo(() => deriveMetrics(filteredByCategory), [filteredByCategory]);
  const upcoming   = useMemo(() => getUpcoming(filteredByCategory),   [filteredByCategory]);
  const typeOptions = useMemo(
    () => [...new Set(activities.map((a) => a.tax_type))].sort(),
    [activities]
  );

  const handleCreate = async (form: TaxActivityForm) => {
    setSaving(true);
    const ok = await create(form);
    setSaving(false);
    if (ok) setAddOpen(false);
  };

  const handleUpdate = async (form: TaxActivityForm) => {
    if (!editItem) return;
    setSaving(true);
    const ok = await update(editItem.id, form);
    setSaving(false);
    if (ok) setEditItem(null);
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setTypeFilter('All'); };

  const editInitial = editItem ? {
    title:         editItem.title,
    description:   editItem.description ?? '',
    tax_type:      editItem.tax_type,
    due_date:      editItem.due_date.slice(0, 16),
    status:        editItem.status,
    reminder_date: editItem.reminder_date?.slice(0, 16) ?? '',
  } : EMPTY_FORM;

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (error) return (
    <div className="p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-8 text-center space-y-4">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-red-600">Failed to Load Tax Calendar</h2>
          <p className="text-sm text-red-500 font-medium break-words">{error}</p>
          
          {/* Diagnostic hints */}
          <div className="border-t border-red-500/10 pt-4 mt-4 text-left">
            <p className="text-xs text-muted-foreground font-semibold mb-2">Possible solutions:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              {error.includes('Unauthorized') && (
                <>
                  <li>You may have been logged out. Try <button onClick={() => window.location.href = '/login'} className="text-blue-500 hover:underline">logging in again</button></li>
                  <li>Your session may have expired</li>
                </>
              )}
              {error.includes('Forbidden') && (
                <>
                  <li>Your account may not have permission to access tax calendar</li>
                  <li>Contact your administrator if this is unexpected</li>
                  <li>Check the <button onClick={() => window.open('/api/fm/reports/tax-calendar/health', '_blank')} className="text-blue-500 hover:underline">health endpoint</button> for more details</li>
                </>
              )}
              {error.includes('Invalid response') && (
                <>
                  <li>There may be a server configuration issue</li>
                  <li>Check browser DevTools → Network tab for request details</li>
                </>
              )}
              {error.includes('Failed to fetch') && (
                <>
                  <li>The server may be unreachable</li>
                  <li>Check your internet connection</li>
                  <li>Check if the backend server is running</li>
                </>
              )}
              <li>Try refreshing the page</li>
            </ul>
          </div>
          
          <div className="flex gap-2 justify-center pt-4">
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('Full error:', error);
                console.log('Check browser console for full error details');
              }}
            >
              Show Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track tax filing deadlines and activities
          </p>
        </div>
        <Button size="sm" className="h-9 px-3 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Tax Date
        </Button>
      </div>

      {/* ── Upcoming deadlines ── */}
      <UpcomingBanner upcoming={upcoming} />

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 w-full">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All" className="text-xs text-muted-foreground">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue placeholder="All Tax Types" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="All" className="text-xs text-muted-foreground">All Tax Types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Metrics ── */}
      <TaxMetricCards {...metrics} />

      {/* ── Calendar ── */}
      <TaxCalendarView activities={filteredByCategory} />

      {/* ── Table ── */}
      <TaxTable
        activities={filtered}
        isFiltered={isFiltered}
        total={activities.length}
        onEdit={setEditItem}
        search={search}
        onSearchChange={setSearch}
      />

      {/* ── Add Dialog ── */}
      <TaxFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
        initial={EMPTY_FORM}
        loading={saving}
        title="Add Tax Date"
      />

      {/* ── Edit Dialog ── */}
      <TaxFormDialog
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleUpdate}
        initial={editInitial}
        loading={saving}
        title="Edit Tax Date"
      />

    </div>
  );
}