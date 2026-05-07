"use client";

import React, { useRef, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Check, X } from "lucide-react";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { getMonthName, getBudgetStatusColor } from "../utils";

export function BudgetApprovalTable() {
    const {
        displayedItems,
        initialLoading,
        loading,
        hasMore,
        loadMore,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        approveBudget,
        rejectBudget,
        total,
        filters
    } = useBudgetApprovalContext();

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback(
        (node: HTMLTableRowElement | null) => {
            if (loading || initialLoading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, initialLoading, hasMore, loadMore]
    );

    if (initialLoading) {
        return (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const allSelected = displayedItems.length > 0 && selectedIds.size === displayedItems.length;
    const isPendingTab = filters.status === "Pending";

    return (
        <div className="relative flex flex-col min-h-0 min-w-0 flex-1 mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground font-medium">
                    Showing {displayedItems.length} of {total} {filters.status.toLowerCase()} budgets
                </span>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-md">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px] py-3 pl-4">
                                {isPendingTab && (
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                )}
                            </TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[80px]">Year</TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[100px]">Month</TableHead>
                            <TableHead className="text-xs font-bold py-3">Division / Department</TableHead>
                            <TableHead className="text-xs font-bold py-3">COA / GL Code</TableHead>
                            <TableHead className="text-xs font-bold py-3">Proposed Amount</TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[120px]">Status</TableHead>
                            <TableHead className="text-xs font-bold py-3 pr-4 text-right w-[180px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                                    No {filters.status.toLowerCase()} budgets found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedItems.map((budget, index) => {
                                const isLast = index === displayedItems.length - 1;
                                return (
                                    <TableRow
                                        key={budget.id}
                                        ref={isLast ? lastElementRef : null}
                                        className="group border-border/40 hover:bg-muted/30 transition-colors"
                                    >
                                        <TableCell className="py-3 pl-4">
                                            {isPendingTab && (
                                                <Checkbox
                                                    checked={selectedIds.has(budget.id)}
                                                    onCheckedChange={() => toggleSelect(budget.id)}
                                                    aria-label={`Select budget ${budget.id}`}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs font-medium py-3">
                                            {budget.year}
                                        </TableCell>
                                        <TableCell className="text-xs py-3">
                                            {getMonthName(budget.month)}
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <p className="text-xs font-semibold text-foreground">
                                                {budget.division_name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {budget.department_name}
                                            </p>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <p className="text-xs font-medium text-foreground">
                                                {budget.coa_name}
                                            </p>
                                            <p className="text-[11px] font-mono text-primary/80">
                                                {budget.gl_code}
                                            </p>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <p className="text-xs font-bold text-foreground">
                                                {new Intl.NumberFormat("en-PH", {
                                                    style: "currency",
                                                    currency: "PHP",
                                                }).format(budget.amount || 0)}
                                            </p>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] uppercase tracking-wider font-bold h-5 px-2 rounded-full ${getBudgetStatusColor(
                                                    budget.status
                                                )}`}
                                            >
                                                {budget.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-3 pr-4 text-right space-x-1">
                                            {budget.status === "Pending" && (
                                                <div className="flex justify-end gap-1">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs gap-1.5 hover:bg-emerald-100 hover:text-emerald-700 transition-all active:scale-95"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                Approve
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Approve Budget?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to approve this budget entry? It will become an active budget.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => approveBudget(budget.id)} className="bg-emerald-600 hover:bg-emerald-700">
                                                                    Approve
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                                Reject
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Reject Budget?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to reject this budget entry? The creator will be notified.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => rejectBudget(budget.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Reject
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                        {loading && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="py-4 text-center">
                                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading more...
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
