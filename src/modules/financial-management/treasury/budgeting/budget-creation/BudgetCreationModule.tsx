// src/modules/financial-management/treasury/budgeting/create-budget/BudgetCreationModule.tsx

"use client";

import React from "react";
import { Send, Trash2, RefreshCw, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
        isModalOpen,
        quickSubmit,
        quickDelete,
        selectedIds,
        clearSelection,
        filters,
        kpiTotals,
    } = useCreateBudgetContext();

    const isRejectedTab = filters.status === "Rejected";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <PlusCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
                            Budget Creation
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1 font-medium">
                            Setup and manage department budgets for approval
                        </p>
                    </div>
                </div>
            </div>
 
             {/* Stats Overview */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                 <StatsCard 
                     label="Draft Amount" 
                     value={kpiTotals.draft}
                     icon={<PlusCircle className="h-4 w-4 text-slate-500" />}
                     color="slate"
                 />
                 <StatsCard 
                     label="Pending Approval" 
                     value={kpiTotals.pending}
                     icon={<Send className="h-4 w-4 text-amber-500" />}
                     color="amber"
                 />
                 <StatsCard 
                     label="Total Approved" 
                     value={kpiTotals.approved}
                     icon={<RefreshCw className="h-4 w-4 text-emerald-500" />}
                     color="emerald"
                 />
                 <StatsCard
                     label="Total Rejected"
                     value={kpiTotals.rejected}
                     icon={<Trash2 className="h-4 w-4 text-rose-500" />}
                     color="rose"
                 />
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
                    <div className="flex items-center gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 px-3 text-[11px] font-black uppercase tracking-tight gap-1.5 active:scale-95 transition-transform"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Quick Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Selected Budgets?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete the {selectedIds.size} selected budget entries? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={quickDelete}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

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
                                        {isRejectedTab ? "Resubmit" : "Submit"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            )}

            {/* Month & Lifecycle Tabs */}
            <div className="flex flex-col gap-5 rounded-2xl border border-border/50 bg-card px-4 py-4 shadow-sm">
                <MonthTabs />
                <Separator />
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

function StatsCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    const colorClasses: Record<string, string> = {
        slate: "bg-slate-500/10 text-slate-700 border-slate-500/20",
        amber: "bg-amber-500/10 text-amber-700 border-amber-500/20",
        emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        rose: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    };

    return (
        <Card className={`rounded-2xl border ${colorClasses[color] || ""} shadow-none`}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 rounded-xl bg-background/50 border border-current/10">
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label}</p>
                    <p className="text-xl font-black tracking-tighter">
                        ₱{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function BudgetCreationModule() {
    return (
        <CreateBudgetProvider>
            <CreateBudgetContent />
        </CreateBudgetProvider>
    );
}
