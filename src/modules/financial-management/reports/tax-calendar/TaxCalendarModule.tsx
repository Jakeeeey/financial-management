"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, AlertCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

import { useTaxCalendar }    from './hooks/useTaxCalendar';
import { TaxMetricCards }    from './components/MetricCard';
import { UpcomingBanner }    from './components/UpComing';
import { TaxFormDialog }     from './components/TaxFormDialog';
import { TaxViewDialog }     from './components/TaxViewDialog';
import { TaxTable }          from './components/TaxTable';
import { TaxListView }       from './components/TaxListView';
import { TaxMappingView }    from './components/TaxMappingView';
import { TaxCalendarView }   from './components/TaxCalendar';
import { deriveMetrics, getUpcoming, applyFilters } from './utils';
import { EMPTY_FORM } from './types';
import type { TaxActivity, TaxActivityForm } from './types';

// Derived status options for the filter dropdown
const DERIVED_STATUSES = ['PENDING', 'UPCOMING', 'OVERDUE', 'FILED', 'PAID'] as const;
const DERIVED_STATUS_LABEL: Record<string, string> = {
  PENDING:  'Pending',
  UPCOMING: 'Upcoming',
  OVERDUE:  'Overdue',
  FILED:    'Filed',
  PAID:     'Paid',
};

export default function TaxCalendarModule() {
  const { loading, error, activities, refetch, create, update } = useTaxCalendar();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [dateBasis,    setDateBasis]    = useState('All');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');
  const [tableView,    setTableView]    = useState<'activities' | 'list' | 'mapping'>('activities');
  const [addOpen,      setAddOpen]      = useState(false);
  const [editItem,     setEditItem]     = useState<TaxActivity | null>(null);
  const [viewItem,     setViewItem]     = useState<TaxActivity | null>(null);
  const [saving,       setSaving]       = useState(false);

  const isFiltered = !!(search || statusFilter !== 'All' || typeFilter !== 'All' || dateBasis !== 'All' || fromDate || toDate);

  const dateFilteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (fromDate || toDate) {
        const aDate = new Date(a.due_date).toISOString().split('T')[0];
        if (fromDate && aDate < fromDate) return false;
        if (toDate   && aDate > toDate)   return false;
      }
      if (dateBasis !== 'All' && a.filing_frequency !== dateBasis) return false;
      return true;
    });
  }, [activities, fromDate, toDate, dateBasis]);

  const filteredByCategory = useMemo(
    () => applyFilters(dateFilteredActivities, '', statusFilter, typeFilter),
    [dateFilteredActivities, statusFilter, typeFilter]
  );

  const filtered = useMemo(
    () => applyFilters(dateFilteredActivities, search, statusFilter, typeFilter),
    [dateFilteredActivities, search, statusFilter, typeFilter]
  );

  const metrics     = useMemo(() => deriveMetrics(filteredByCategory),   [filteredByCategory]);
  const upcoming    = useMemo(() => getUpcoming(filteredByCategory),     [filteredByCategory]);
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

  const clearFilters = () => {
    setSearch(''); setStatusFilter('All'); setTypeFilter('All');
    setDateBasis('All'); setFromDate(''); setToDate('');
  };

  const editInitial = editItem ? {
    title:              editItem.title,
    description:        editItem.description ?? '',
    tax_type:           editItem.tax_type,
    bir_form:           editItem.bir_form ?? '',
    filing_frequency:   editItem.filing_frequency ?? 'Monthly',
    due_date_rule:      editItem.due_date_rule ?? '',
    due_date:           editItem.due_date.slice(0, 16),
    actual_filing_date: editItem.actual_filing_date?.slice(0, 16) ?? '',
    payment_date:       editItem.payment_date?.slice(0, 16) ?? '',
    amount_paid:        editItem.amount_paid?.toString() ?? '',
    reminder_date:      editItem.reminder_date?.slice(0, 16) ?? '',
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
                </>
              )}
              {error.includes('Failed to fetch') && (
                <>
                  <li>The server may be unreachable</li>
                  <li>Check your internet connection</li>
                </>
              )}
              <li>Try refreshing the page</li>
            </ul>
          </div>
          <div className="flex gap-2 justify-center pt-4">
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
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
        <Select value={dateBasis} onValueChange={setDateBasis}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="Date Basis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All"       className="text-xs">All Frequency</SelectItem>
            <SelectItem value="Monthly"   className="text-xs">Monthly</SelectItem>
            <SelectItem value="Quarterly" className="text-xs">Quarterly</SelectItem>
            <SelectItem value="Annually"  className="text-xs">Annually</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 px-3 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 px-3 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Status filter now uses derived statuses */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All" className="text-xs text-muted-foreground">All Statuses</SelectItem>
            {DERIVED_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{DERIVED_STATUS_LABEL[s]}</SelectItem>
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

        <div className="relative w-full sm:w-72 flex-shrink-0" style={{maxWidth: 288}}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search title, tax type, form…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 w-full text-xs"
          />
        </div>

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

      {/* ── Table View Switcher ── */}
      <div className="flex gap-3 border-b border-border/50 pb-3">
        {(['activities', 'list', 'mapping'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setTableView(v)}
            className={`text-sm font-medium px-3 py-2 rounded-t-lg transition-colors border-b-2 ${
              tableView === v
                ? 'text-foreground border-b-primary'
                : 'text-muted-foreground border-b-transparent hover:text-foreground'
            }`}
          >
            {v === 'activities' ? 'Tax Activities' : v === 'list' ? 'List View' : 'Tax Mapping'}
          </button>
        ))}
      </div>

      {tableView === 'activities' && (
        <TaxTable activities={filtered} isFiltered={isFiltered} total={activities.length} onView={setViewItem} />
      )}
      {tableView === 'list' && (
        <TaxListView activities={filtered} isFiltered={isFiltered} />
      )}
      {tableView === 'mapping' && (
        <TaxMappingView activities={filtered} isFiltered={isFiltered} />
      )}

      <TaxViewDialog open={!!viewItem} onClose={() => setViewItem(null)} item={viewItem}
        onEdit={(item) => { setViewItem(null); setEditItem(item); }} />

      <TaxFormDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={handleCreate}
        initial={EMPTY_FORM} loading={saving} title="Add Tax Date" />

      <TaxFormDialog open={!!editItem} onClose={() => setEditItem(null)} onSave={handleUpdate}
        initial={editInitial as TaxActivityForm} loading={saving} title="Edit Tax Date" />
    </div>
  );
}