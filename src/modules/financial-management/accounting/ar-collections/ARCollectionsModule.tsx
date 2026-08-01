// ARCollectionsModule.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollectionsWorklist } from './hooks/useCollectionsWorklist';
import { useCommitmentActions } from './hooks/useCommitmentActions';
import { CollectionStatCards } from './components/CollectionStatCards';
import { WorklistTable } from './components/WorklistTable';
import { CommitmentCalendar } from './components/CommitmentCalendar';
import { SalesmanSummaryPanel } from './components/SalesmanSummaryPanel';
import { BulkLogCommitmentModal } from './components/BulkLogCommitmentModal';
import { InvoiceNotesDrawer } from './components/InvoiceNotesDrawer';
import { OutreachTemplatesDrawer } from './components/OutreachTemplatesDrawer';
import { ARCollectionCommitment } from './types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Users, ClipboardList, RefreshCw, Search } from 'lucide-react';
import { Invoice } from '../accounts-receivable/types';

export default function ARCollectionsModule() {
  const [activeTab, setActiveTab] = useState<string>('worklist');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [initialSalesmanCode, setInitialSalesmanCode] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Discussion logs state
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const [notesInvoiceNo, setNotesInvoiceNo] = useState('');
  const [notesCustomerName, setNotesCustomerName] = useState('');

  // Outreach templates state
  const [templatesDrawerOpen, setTemplatesDrawerOpen] = useState(false);
  const [selectedTemplateInvoice, setSelectedTemplateInvoice] = useState<Invoice | null>(null);
  const [selectedTemplateCommitment, setSelectedTemplateCommitment] = useState<ARCollectionCommitment | null>(null);

  const deferredSearch = React.useDeferredValue(searchQuery);
  const deferredSalesman = React.useDeferredValue(salesmanFilter);
  const deferredStatus = React.useDeferredValue(statusFilter);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [deferredSearch, deferredSalesman, deferredStatus]);

  // Hook for fetching data
  const {
    loading,
    error,
    commitments,
    mergedRows,
    totalPages,
    totalCount,
    stats: serverStats,
    filterOptions,
    refresh
  } = useCollectionsWorklist({
    salesman: deferredSalesman,
    status: deferredStatus,
    search: deferredSearch,
    page,
    pageSize,
  });

  const { updateStatus } = useCommitmentActions(refresh);

  // Read server-calculated stats with client-side fallback
  const stats = serverStats || {
    totalOutstanding: 0,
    totalCommitted: 0,
    brokenCount: 0,
    pendingCount: 0,
  };

  const missedCount = useMemo(() => {
    if (!commitments) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    return commitments.filter((c: ARCollectionCommitment) => c.status === 'pending' && c.commitmentDate < todayStr).length;
  }, [commitments]);

  const handleLogCommitment = (invoice: Invoice) => {
    setInitialSalesmanCode(invoice.salesmanCode || null);
    setBulkModalOpen(true);
  };

  const handleUpdateStatus = (commitmentId: string, status: 'kept' | 'broken') => {
    updateStatus(commitmentId, status, `Marked ${status} from collections worklist.`);
  };

  if (error) {
    return (
      <div className="p-6 text-center text-xs text-destructive border border-destructive/30 rounded m-4">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-4 bg-background text-foreground min-h-screen space-y-4 w-full box-border overflow-hidden">
      
      {/* Header and Sync */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight">AR Collections Management</h1>
          <p className="text-[10px] text-muted-foreground">
            Manage customer promise-to-pay (PTP) commitments and follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={() => setBulkModalOpen(true)}
            className="h-7 text-[10px] gap-1 px-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold"
          >
            + Bulk Log PTP
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="h-7 text-[10px] gap-1 px-2.5"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <CollectionStatCards
        totalOutstanding={stats.totalOutstanding}
        totalCommitted={stats.totalCommitted}
        brokenPromisesCount={stats.brokenCount}
        pendingFollowUps={stats.pendingCount}
      />

      {/* Missed PTP warning notifications */}
      {missedCount > 0 && (
        <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400">
          <AlertTitle className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
            ⚠️ Missed Payment Commitments Alert
          </AlertTitle>
          <AlertDescription className="text-[10px] mt-1 font-medium">
            There are <strong>{missedCount}</strong> pending PTP commitments that have passed their commitment date without being settled. Please check the worklist.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Layout Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md shadow-sm">
          
          {/* View Selection Toggles */}
          <TabsList className="grid w-fit grid-cols-3 h-8 p-1">
            <TabsTrigger value="worklist" className="text-[10px] px-3 gap-1 h-6">
              <ClipboardList className="h-3 w-3" />
              Worklist
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-[10px] px-3 gap-1 h-6">
              <Calendar className="h-3 w-3" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="salesmen" className="text-[10px] px-3 gap-1 h-6">
              <Users className="h-3 w-3" />
              Salesmen
            </TabsTrigger>
          </TabsList>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[180px] h-7">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer / invoice..."
                className="h-7 pl-8 text-[10px] bg-background"
              />
            </div>

            <SearchableSelect
              value={salesmanFilter}
              onValueChange={setSalesmanFilter}
              placeholder="All Salesmen"
              className="h-7 w-[150px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: 'all', label: 'All Salesmen' },
                ...Array.from(new Set((filterOptions?.salesmen || []).filter(name => name && name.trim() && name.toLowerCase() !== 'all')))
                  .map((name) => ({ value: name, label: name })),
              ]}
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 w-[130px] text-[10px] bg-background">
                <SelectValue placeholder="All PTP Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px]">All PTP Status</SelectItem>
                <SelectItem value="unassigned" className="text-[10px]">Unassigned (New)</SelectItem>
                <SelectItem value="pending" className="text-[10px]">Pending PTP</SelectItem>
                <SelectItem value="kept" className="text-[10px]">Kept PTP</SelectItem>
                <SelectItem value="broken" className="text-[10px]">Broken PTP</SelectItem>
                <SelectItem value="rescheduled" className="text-[10px]">Rescheduled</SelectItem>
                <SelectItem value="waived" className="text-[10px]">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab contents */}
        <AnimatePresence mode="wait">
          {activeTab === 'worklist' && (
            <TabsContent value="worklist" key="worklist" className="mt-0 focus-visible:outline-none" forceMount>
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <WorklistTable
                  rows={mergedRows}
                  loading={loading}
                  onLogCommitment={handleLogCommitment}
                  onUpdateStatus={handleUpdateStatus}
                  onViewNotes={(invNo, name) => {
                    setNotesInvoiceNo(invNo);
                    setNotesCustomerName(name);
                    setNotesDrawerOpen(true);
                  }}
                  onViewTemplates={(inv, comm) => {
                    setSelectedTemplateInvoice(inv);
                    setSelectedTemplateCommitment(comm);
                    setTemplatesDrawerOpen(true);
                  }}
                />
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 bg-card/45 backdrop-blur-md rounded-xl border border-border/50 shadow-sm shrink-0">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Showing {Math.min(totalCount, (page - 1) * pageSize + 1)}–{Math.min(page * pageSize, totalCount)} of {totalCount} invoices
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1 || loading}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="h-7 text-[10px] px-2.5"
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-bold px-2 text-foreground">
                        {page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages || loading}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="h-7 text-[10px] px-2.5"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>
          )}

          {activeTab === 'calendar' && (
            <TabsContent value="calendar" key="calendar" className="mt-0 focus-visible:outline-none" forceMount>
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                <CommitmentCalendar
                  commitments={commitments}
                  onRefresh={refresh}
                />
              </motion.div>
            </TabsContent>
          )}

          {activeTab === 'salesmen' && (
            <TabsContent value="salesmen" key="salesmen" className="mt-0 focus-visible:outline-none" forceMount>
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                <SalesmanSummaryPanel
                  rows={mergedRows}
                  loading={loading}
                />
              </motion.div>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Log Commitments Dialog */}
      <BulkLogCommitmentModal
        open={bulkModalOpen}
        onOpenChange={(open) => {
          setBulkModalOpen(open);
          if (!open) setInitialSalesmanCode(null);
        }}
        onSuccess={refresh}
        initialSalesmanCode={initialSalesmanCode}
      />

      {/* Discussion Timeline Drawer */}
      <InvoiceNotesDrawer
        invoiceNo={notesInvoiceNo}
        customerName={notesCustomerName}
        open={notesDrawerOpen}
        onOpenChange={setNotesDrawerOpen}
        onNoteAdded={refresh}
      />

      {/* Outreach Templates Drawer */}
      <OutreachTemplatesDrawer
        invoice={selectedTemplateInvoice}
        commitment={selectedTemplateCommitment}
        open={templatesDrawerOpen}
        onOpenChange={setTemplatesDrawerOpen}
      />
    </div>
  );
}
