// src/modules/financial-management/treasury/salesmen-expense-approval/SalesmenExpenseApprovalModule.tsx
"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


import { useSalesmanExpenseApproval } from "./hooks/useSalesmanExpenseApproval";
import SalesmanExpenseTable from "./components/SalesmanExpenseTable";
import ExpenseApprovalModal from "./components/ExpenseApprovalModal";
import { ApprovalLogTable } from "./components/ApprovalLogTable";

export default function SalesmenExpenseApprovalModule() {
  const {
    rows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    modalOpen,
    modalLoading,
    salesmanDetail,
    logs,
    logsLoading,
    openModal,
    closeModal,
    onConfirmed,
  } = useSalesmanExpenseApproval();

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Salesman Expense Approval
          </h1>
          <p className="text-muted-foreground">
            Manage and process pending expenses with budget compliance tracking.
          </p>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95"
          onClick={() => window.location.reload()}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Table card */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Pending Approval List
                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                  Live
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Review salesmen with <span className="font-medium text-amber-600 italic">Draft</span> or <span className="font-medium text-red-600 italic">Rejected</span> status.
              </p>
            </div>
          </div>

          <SalesmanExpenseTable
            rows={rows}
            totalItems={totalItems}
            q={q}
            setQ={setQ}
            page={page}
            setPage={setPage}
            pageCount={pageCount}
            loading={loading}
            onAction={openModal}
          />
        </CardContent>
      </Card>

      {/* Logs section */}
      <div className="pt-4">
        <ApprovalLogTable logs={logs} loading={logsLoading} />
      </div>

      {/* Approval Modal */}
      <ExpenseApprovalModal
        open={modalOpen}
        loading={modalLoading}
        detail={salesmanDetail}
        onClose={closeModal}
        onConfirmed={onConfirmed}
      />
    </div>
  );
}
