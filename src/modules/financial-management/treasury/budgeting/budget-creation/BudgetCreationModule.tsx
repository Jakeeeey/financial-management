// src/modules/financial-management/treasury/budgeting/create-budget/BudgetCreationModule.tsx

"use client";

import React from "react";
import { Plus, Send, RefreshCw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
import { CreateBudgetProvider, useCreateBudgetContext } from "./providers/CreateBudgetProvider";
import { CreateBudgetFilters } from "./components/CreateBudgetFilters";
import { MonthTabs } from "./components/MonthTabs";
import { LifecycleTabs } from "./components/LifecycleTabs";
import { CreateBudgetGroupedTable } from "./components/CreateBudgetGroupedTable";
import { CreateBudgetModal } from "./components/CreateBudgetModal";

function CreateBudgetContent() {
    const {
        openModal,
        isModalOpen,
        quickSubmit,
        selectedIds,
        clearSelection,
        clearFilters,
        filters,
    } = useCreateBudgetContext();

    const isRejectedTab = filters.status === "Rejected";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase">
                        Budget Creation
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                        Setup and manage department budgets for approval
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/fm/treasury/budgeting/budget-audit-trail">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 text-xs gap-1.5 border-primary/20 hover:bg-primary/5 hover:text-primary active:scale-95 transition-transform"
                        >
                            <History className="h-3.5 w-3.5" />
                            Audit Trail
                        </Button>
                    </Link>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={clearFilters}
                        className="h-9 px-3 text-xs gap-1.5 active:scale-95 transition-transform"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={openModal}
                        className="h-9 px-4 text-xs gap-2 font-bold rounded-xl shadow-sm active:scale-95 transition-transform"
                    >
                        <Plus className="h-4 w-4" />
                        Create Budget
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-4 bg-muted/20">
                    <CreateBudgetFilters />
                </CardContent>
            </Card>

            {/* Selection Bar (Floating or Inline) */}
            {selectedIds.size > 0 && (
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
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-3 text-[11px] font-black uppercase tracking-tight gap-1.5 active:scale-95 transition-transform"
                            >
                                <Send className="h-3 w-3" />
                                {isRejectedTab ? "Quick Resubmit" : "Quick Submit"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {isRejectedTab ? "Resubmit Selected Budgets?" : "Submit Selected Budgets?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {isRejectedTab 
                                      ? `Are you sure you want to resubmit the ${selectedIds.size} selected rejected budget entries for approval?`
                                      : `Are you sure you want to submit the ${selectedIds.size} selected budget entries for approval? They will no longer be in draft status.`
                                    }
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={quickSubmit} className="bg-primary hover:bg-primary/90">
                                    Submit All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {/* Month & Lifecycle Tabs */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm px-4 py-3 space-y-4">
                <MonthTabs />
                <LifecycleTabs />
            </div>

            {/* Table Section */}
            <div className="flex flex-1 min-h-0 min-w-0">
                <CreateBudgetGroupedTable />
            </div>

            {/* Modals */}
            {isModalOpen && <CreateBudgetModal />}
        </div>
    );
}

export default function BudgetCreationModule() {
    return (
        <CreateBudgetProvider>
            <CreateBudgetContent />
        </CreateBudgetProvider>
    );
}
