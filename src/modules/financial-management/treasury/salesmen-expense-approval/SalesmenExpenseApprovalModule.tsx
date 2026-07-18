// src/modules/financial-management/treasury/salesmen-expense-approval/SalesmenExpenseApprovalModule.tsx
"use client";

import * as React from "react";
import { RefreshCw, ShieldAlert, ArrowLeft, ShieldCheck, History, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useSalesmanExpenseApproval } from "./hooks/useSalesmanExpenseApproval";
import SalesmanExpenseTable from "./components/SalesmanExpenseTable";
import ExpenseApprovalModal from "./components/ExpenseApprovalModal";
import { ApprovalLogTable } from "./components/ApprovalLogTable";
import HeaderSelectionPanel from "./components/HeaderSelectionPanel";

export default function SalesmenExpenseApprovalModule() {
  const {
    listMode,
    setListMode,
    rows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    // Panel state
    selectedSalesman,
    salesmanDetail,
    detailLoading,
    selectSalesman,
    closePanel,
    // Header selection
    selectedHeader,
    openModalForHeader,
    // Modal state
    modalOpen,
    modalLoading,
    closeModal,
    onConfirmed,
    // Logs
    logs,
    logsLoading,
    unauthorized,
  } = useSalesmanExpenseApproval();

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] p-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-destructive/10 p-6 rounded-full mb-6 ring-4 ring-destructive/5">
          <ShieldAlert className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Access Restricted</h1>
        <p className="text-muted-foreground mt-3 max-w-lg font-medium text-lg">
          You do not have the required permissions to view this module. This area is strictly restricted to Department Heads and Division Supervisors.
        </p>
        <Button 
          className="mt-8 rounded-full font-bold shadow-lg flex items-center gap-2" 
          onClick={() => window.location.href = '/dashboard'} 
          variant="default"
          size="lg"
        >
          <ArrowLeft className="h-5 w-5" />
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] pb-4 space-y-6 px-4 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 bg-primary/10 dark:bg-primary/20 rounded-[1.5rem] flex items-center justify-center text-primary border border-primary/10 dark:border-primary/20 shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Expense Verification
            </h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Treasury Audit Workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-12 w-[1px] bg-slate-100 dark:bg-slate-800 mx-2" />
          <Button
            className="rounded-full shadow-lg font-bold tracking-wide shadow-primary/20 active:scale-95 transition-all"
            onClick={() => window.location.reload()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh View
          </Button>
        </div>
      </div>

      {/* Main Content Splitting */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* Left Side: Salesmen */}
        <div className="flex-[7] flex flex-col min-h-0 bg-card dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-muted/10 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {listMode === "pending" ? "Pending Authorization List" : "Decision History"}
                <Badge variant="secondary" className="font-bold text-[10px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors uppercase tracking-widest px-2 py-0.5 ml-2">
                  {listMode === "pending" ? "Live Data" : "Archive"}
                </Badge>
              </h2>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {listMode === "pending"
                  ? "Select an ongoing draft application to review receipts and allocate balances."
                  : "Find completed or rejected submissions and reopen their audit details."}
              </p>
            </div>
            <div className="flex rounded-full border bg-background p-1 shadow-sm dark:border-slate-700">
              <Button
                size="sm"
                variant={listMode === "pending" ? "default" : "ghost"}
                className="h-8 rounded-full px-4 text-[10px] font-black uppercase tracking-wider"
                onClick={() => setListMode("pending")}
              >
                <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Pending
              </Button>
              <Button
                size="sm"
                variant={listMode === "history" ? "default" : "ghost"}
                className="h-8 rounded-full px-4 text-[10px] font-black uppercase tracking-wider"
                onClick={() => setListMode("history")}
              >
                <History className="mr-1.5 h-3.5 w-3.5" /> History
              </Button>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col min-h-0 bg-muted/5 dark:bg-slate-900/50">
            <SalesmanExpenseTable
              rows={rows}
              totalItems={totalItems}
              q={q}
              setQ={setQ}
              page={page}
              setPage={setPage}
              pageCount={pageCount}
              loading={loading}
              mode={listMode}
              onAction={selectSalesman}
              selectedId={selectedSalesman?.id}
            />
          </div>
        </div>

        {/* Right Side: Logs or Header Selection */}
        <div className="flex-[3] flex flex-col min-h-0 bg-card dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {selectedSalesman ? (
            <HeaderSelectionPanel
              selectedSalesman={selectedSalesman}
              detail={salesmanDetail}
              loading={detailLoading}
              onClose={closePanel}
              onSelectHeader={openModalForHeader}
              initialTab={listMode}
            />
          ) : (
            <div className="p-6 h-full flex flex-col">
              <ApprovalLogTable logs={logs} loading={logsLoading} />
            </div>
          )}
        </div>

      </div>

      {/* Approval Modal */}
      <ExpenseApprovalModal
        open={modalOpen}
        loading={modalLoading}
        detail={salesmanDetail}
        selectedHeader={selectedHeader}
        onClose={closeModal}
        onConfirmed={onConfirmed}
      />
    </div>
  );
}
