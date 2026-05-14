"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ListFilter } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useDailyCollectionReport } from "../hooks/useDailyCollectionReport";
import { CollectionItem } from "../types";

const ITEMS_PER_PAGE = 10;

export const CollectionTable = () => {
    const { reportData, formatCurrency, error } = useDailyCollectionReport();
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(reportData.length / ITEMS_PER_PAGE);
    
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return reportData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [reportData, currentPage]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-sm font-medium">Transaction Details</CardTitle>
                            <CardDescription className="text-xs">
                                Detailed records for the selected date
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                        {reportData.length} records
                    </Badge>
                </div>
            </CardHeader>
            <Separator />

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="[&_th]:whitespace-nowrap">
                            <TableHead className="text-xs w-10">#</TableHead>
                            <TableHead className="text-xs">Doc No</TableHead>
                            <TableHead className="text-xs">Receipt No</TableHead>
                            <TableHead className="text-xs">Collection Date</TableHead>
                            <TableHead className="text-xs">Date Encoded</TableHead>
                            <TableHead className="text-xs">Salesman</TableHead>
                            <TableHead className="text-xs">Collected By</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Method</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Remarks</TableHead>
                            <TableHead className="text-xs text-right">Detail Amt</TableHead>
                            <TableHead className="text-xs text-right">Total Amt</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((item: CollectionItem, i: number) => {
                            const rowNo = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                            return (
                                <TableRow key={`${item.id}-${i}`} className="[&_td]:whitespace-nowrap">
                                    <TableCell className="text-xs text-muted-foreground">{rowNo}</TableCell>
                                    <TableCell className="text-xs font-medium">{item.docNo || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.receiptNo || "—"}</TableCell>
                                    <TableCell className="text-xs">
                                        {format(new Date(item.collectionDate), "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {format(new Date(item.dateEncoded), "MMM dd, yy")}
                                    </TableCell>
                                    <TableCell className="text-xs font-medium truncate max-w-[120px]" title={item.salesman}>
                                        {item.salesman || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={item.collectedBy}>
                                        {item.collectedBy || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap bg-muted/50 border-muted-foreground/20">
                                            {item.type || "—"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap bg-blue-50/50 border-blue-200/50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                                            {item.paymentMethodName || "—"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <Badge 
                                            variant={item.isCancelled === 1 ? "destructive" : item.isPosted === 1 ? "default" : "secondary"} 
                                            className={`text-[10px] font-normal whitespace-nowrap ${item.isPosted === 1 && item.isCancelled !== 1 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20' : ''}`}
                                        >
                                            {item.isCancelled === 1 ? "Cancelled" : item.isPosted === 1 ? "Posted" : "Pending"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                                        {item.remarks || item.detailRemarks || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-right tabular-nums">
                                        {formatCurrency(item.detailAmount || 0)}
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-right tabular-nums">
                                        {formatCurrency(item.totalAmount || 0)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        {reportData.length === 0 && !error && (
                            <TableRow>
                                <TableCell colSpan={13} className="h-32 text-center text-xs text-muted-foreground">
                                    No data found for the selected date.
                                </TableCell>
                            </TableRow>
                        )}
                        {error && (
                            <TableRow>
                                <TableCell colSpan={13} className="h-32 text-center">
                                    <p className="text-xs font-medium text-destructive">Failed to load data</p>
                                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <>
                    <Separator />
                    <CardContent className="py-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, reportData.length)} of {reportData.length}
                        </p>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className={currentPage === 1 ? "pointer-events-none opacity-50 cursor-default" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                                {[...Array(totalPages)].map((_, idx) => {
                                    const page = idx + 1;
                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                        return (
                                            <PaginationItem key={page}>
                                                <PaginationLink
                                                    isActive={currentPage === page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className="cursor-pointer"
                                                >
                                                    {page}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    }
                                    if (page === currentPage - 2 || page === currentPage + 2) {
                                        return <PaginationItem key={page}><PaginationEllipsis /></PaginationItem>;
                                    }
                                    return null;
                                })}
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className={currentPage === totalPages ? "pointer-events-none opacity-50 cursor-default" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </CardContent>
                </>
            )}
        </Card>
    );
};
