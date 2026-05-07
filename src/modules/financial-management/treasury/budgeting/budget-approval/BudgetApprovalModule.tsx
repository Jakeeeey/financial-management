"use client";

import React from "react";
import { Check, X, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BudgetApprovalProvider, useBudgetApprovalContext } from "./providers/BudgetApprovalProvider";
import { BudgetApprovalFilters } from "./components/BudgetApprovalFilters";
import { BudgetApprovalTable } from "./components/BudgetApprovalTable";

function BudgetApprovalContent() {
    const {
        selectedIds,
        clearSelection,
        clearFilters,
        bulkApprove,
        bulkReject,
        filters
    } = useBudgetApprovalContext();

    const isPendingTab = filters.status === "Pending";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase">
                        Budget Approval
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                        Review, approve, or reject pending department budgets
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={clearFilters}
                        className="h-9 px-3 text-xs gap-1.5 active:scale-95 transition-transform"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reset Filters
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-4 bg-muted/20">
                    <BudgetApprovalFilters />
                </CardContent>
            </Card>

            {/* Selection Bar (Floating or Inline) */}
            {isPendingTab && selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-2 text-primary-foreground shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-bold">
                            {selectedIds.size} budget(s) selected
                        </span>
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-primary-foreground/80 hover:text-primary-foreground underline decoration-primary-foreground/30"
                            onClick={clearSelection}
                        >
                            Deselect all
                        </Button>
                    </div>
                    
                    <div className="flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 px-3 text-[11px] font-black uppercase tracking-tight gap-1.5 active:scale-95 transition-transform bg-white text-emerald-700 hover:bg-emerald-50 border-none"
                                >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Approve All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Approve Selected Budgets?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to approve the {selectedIds.size} selected budget entries? 
                                        They will become active budgets.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={bulkApprove} className="bg-emerald-600 hover:bg-emerald-700">
                                        Approve All
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 px-3 text-[11px] font-black uppercase tracking-tight gap-1.5 active:scale-95 transition-transform bg-white text-destructive hover:bg-destructive/10 border-none"
                                >
                                    <XCircle className="h-3 w-3" />
                                    Reject All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Reject Selected Budgets?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to reject the {selectedIds.size} selected budget entries? 
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={bulkReject} className="bg-destructive hover:bg-destructive/90">
                                        Reject All
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            )}

            {/* Table Section */}
            <div className="flex flex-1 min-h-0 min-w-0">
                <BudgetApprovalTable />
            </div>
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
