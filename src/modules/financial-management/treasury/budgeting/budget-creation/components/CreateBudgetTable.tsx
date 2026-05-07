// src/modules/financial-management/treasury/budgeting/create-budget/components/CreateBudgetTable.tsx

"use client";

import React, { useRef, useEffect, useCallback } from "react";
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
import { Loader2, Send, Pencil, Trash2, Plus } from "lucide-react";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { getMonthName, getBudgetStatusColor } from "../utils";

export function CreateBudgetTable() {
    const {
        displayedItems,
        initialLoading,
        loading,
        hasMore,
        loadMore,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        submitForApproval,
        openEditModal,
        openSupplementModal,
        deleteBudget,
        getGrandTotal,
        hasInFlightSupplement,
        total,
    } = useCreateBudgetContext();

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

    return (
        <div className="relative flex flex-col min-h-0 min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground font-medium">
                    Showing {displayedItems.length} of {total} budgets
                </span>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-md">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px] py-3 pl-4">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all"
                                />
                            </TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[80px]">Year</TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[100px]">Month</TableHead>
                            <TableHead className="text-xs font-bold py-3">Division / Department</TableHead>
                            <TableHead className="text-xs font-bold py-3">COA / GL Code</TableHead>
                            <TableHead className="text-xs font-bold py-3">Proposed Amount</TableHead>
                            <TableHead className="text-xs font-bold py-3 w-[120px]">Status</TableHead>
                            <TableHead className="text-xs font-bold py-3 pr-4 text-right w-[150px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                                    No budgets found.
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
                                            <Checkbox
                                                checked={selectedIds.has(budget.id)}
                                                onCheckedChange={() => toggleSelect(budget.id)}
                                                aria-label={`Select budget ${budget.id}`}
                                            />
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
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-medium text-foreground">
                                                        {budget.coa_name}
                                                    </p>
                                                    {budget.entry_type === "supplemental" && (
                                                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-black tracking-tight text-blue-600 bg-blue-100 border-none uppercase">
                                                            SUPPLEMENTAL
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-mono text-primary/80">
                                                    {budget.gl_code}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <p className="text-xs font-bold text-foreground">
                                                {new Intl.NumberFormat("en-PH", {
                                                    style: "currency",
                                                    currency: "PHP",
                                                }).format(budget.amount || 0)}
                                            </p>
                                            {budget.status === "Approved" && budget.entry_type !== "supplemental" && getGrandTotal(budget.id) > budget.amount && (
                                                <p className="text-[10px] font-bold text-emerald-600 mt-1">
                                                    Total: {new Intl.NumberFormat("en-PH", {
                                                        style: "currency",
                                                        currency: "PHP",
                                                    }).format(getGrandTotal(budget.id))}
                                                </p>
                                            )}
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
                                            {budget.status === "Draft" && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditModal(budget)}
                                                        className="h-8 px-2 text-xs gap-1.5 hover:bg-muted transition-all active:scale-95"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                                Submit
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Submit for Approval?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to submit this budget entry for approval? Once submitted, it will no longer be in draft status.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => submitForApproval(budget.id)} className="bg-primary hover:bg-primary/90">
                                                                    Submit
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
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Delete
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete this draft budget entry.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => deleteBudget(budget.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </>
                                            )}
                                            {budget.status === "Approved" && (() => {
                                                const inFlight = hasInFlightSupplement(budget.id);
                                                return (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openSupplementModal(budget)}
                                                        disabled={inFlight}
                                                        title={inFlight ? "A supplement for this budget is already Draft or Pending" : "Request additional funding"}
                                                        className={`h-8 px-2 text-xs gap-1.5 transition-all active:scale-95 ${
                                                            inFlight
                                                                ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                                                : "hover:bg-blue-50 hover:text-blue-600 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        {inFlight ? "Supplement Pending" : "Request Supplement"}
                                                    </Button>
                                                );
                                            })()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                        {loading && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={7} className="py-4 text-center">
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
