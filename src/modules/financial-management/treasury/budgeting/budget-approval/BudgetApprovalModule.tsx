"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetApprovalProvider, useBudgetApprovalContext } from "./providers/BudgetApprovalProvider";
import { MonthTabs } from "./components/MonthTabs";
import { StatusTabs } from "./components/StatusTabs";
import { BudgetApprovalFilters } from "./components/BudgetApprovalFilters";
import { BudgetApprovalTable } from "./components/BudgetApprovalTable";
import { ApprovalActionDialog } from "./components/ApprovalActionDialog";
import { BudgetApprovalSummaryCards } from "./components/BudgetApprovalSummaryCards";
import { formatCurrency as fmt } from "./utils";
import type { Budget } from "./types";

function BudgetApprovalContent() {
    const {
        displayedItems,
        selectedIds,
        clearSelection,
        clearFilters,
        bulkApprove,
        bulkReject,
        filters,
        loading
    } = useBudgetApprovalContext();

    const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);

    const isPendingTab = filters.status === "Pending";

    // Compute active selection cumulative pricing securely
    const selectedItemsTotal = React.useMemo(() => {
        return (displayedItems || [])
            .filter((b: Budget) => selectedIds.has(String(b.id)))
            .reduce((sum: number, b: Budget) => sum + Number(b.amount || 0), 0);
    }, [displayedItems, selectedIds]);

    const handleBulkConfirm = (remarks: string) => {
        if (bulkAction === "approve") bulkApprove(remarks);
        if (bulkAction === "reject") bulkReject(remarks);
        setBulkAction(null);
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {/* Header Section */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm border border-primary/5 shrink-0">
                    <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
                        Budget Approval
                    </h1>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-1 opacity-70">
                        Management Review Workflow
                    </p>
                </div>
            </div>

            {/* Two-Column Macro Dashboard Strip */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                {/* Column 1: Unified Dashboard Frame (Filters + Reset + Months + Status Tabs) */}
                <div className="xl:col-span-8 flex flex-col justify-between rounded-2xl border border-border/50 bg-card shadow-sm p-4 gap-4">
                    {/* Top: Embedded Search, Sub-filters & Relocated Reset Strip */}
                    <div className="flex items-start gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        <div className="min-w-0 flex-1">
                            <BudgetApprovalFilters />
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={clearFilters}
                            title="Reset Filters"
                            className="h-9 w-9 p-0 rounded-xl border-border/40 active:scale-95 transition-all hover:bg-primary/5 shadow-sm shrink-0 mt-0.5"
                        >
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>

                    {/* Middle: Month Navigation Strip */}
                    <div className="overflow-x-auto scrollbar-none py-0.5">
                        <MonthTabs />
                    </div>

                    {/* Bottom: Pure Status Controls Strip */}
                    <div className="border-t border-border/30 pt-3 mt-auto">
                        <StatusTabs />
                    </div>
                </div>

                {/* Column 2: Stacked Macro Metrics Group */}
                <div className="xl:col-span-4 flex items-center">
                    <BudgetApprovalSummaryCards />
                </div>
            </div>

            {/* Selection Bar (Premium Floating Style) */}
            {isPendingTab && selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-3 text-white shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 border border-white/10 mx-2">
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                            <span className="text-xs font-black">{selectedIds.size}</span>
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">Selection</span>
                                {selectedItemsTotal > 0 && (
                                    <span className="text-xs font-mono font-black text-emerald-400 tracking-tight">
                                        ({fmt(selectedItemsTotal)})
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-[11px] font-bold text-primary/80 hover:text-primary underline-offset-4 justify-start"
                                onClick={clearSelection}
                            >
                                Clear all selections
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setBulkAction("reject")}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 active:scale-95 transition-all bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white border-none rounded-xl"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                        </Button>
                        
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setBulkAction("approve")}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 active:scale-95 transition-all bg-emerald-600 text-white hover:bg-emerald-500 border-none rounded-xl shadow-lg shadow-emerald-900/20"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                        </Button>
                    </div>
                </div>
            )}

            {/* Table Section */}
            <div className="flex flex-1 min-h-0 min-w-0">
                <BudgetApprovalTable />
            </div>

            {/* Bulk Action Dialog */}
            {bulkAction && (
                <ApprovalActionDialog 
                    isOpen={!!bulkAction}
                    onClose={() => setBulkAction(null)}
                    onConfirm={handleBulkConfirm}
                    type={bulkAction}
                    count={selectedIds.size}
                    loading={loading}
                />
            )}
        </div>
    );
}

export default function BudgetApprovalModule() {
    return (
        <BudgetApprovalProvider>
            <BudgetApprovalContent />
        </BudgetApprovalProvider>
    );
}
