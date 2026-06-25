"use client";

import React from "react";
import { Disbursement } from "../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Building2 } from "lucide-react";
import { StickyTableWrapper } from "./StickyTableWrapper";
import { formatCurrency } from "../utils/disbursement-utils";

interface CashIssuanceApprovalTableProps {
    data: Disbursement[];
    loading: boolean;
    onView: (d: Disbursement) => void;
    selectedIds: number[];
    onSelectChange: (ids: number[]) => void;
}

export function CashIssuanceApprovalTable({
    data,
    loading,
    onView,
    selectedIds,
    onSelectChange
}: CashIssuanceApprovalTableProps) {

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectChange(data.map((d) => d.id));
        } else {
            onSelectChange([]);
        }
    };

    const handleSelectRow = (id: number, checked: boolean) => {
        if (checked) {
            onSelectChange([...selectedIds, id]);
        } else {
            onSelectChange(selectedIds.filter((item) => item !== id));
        }
    };

    const isAllSelected = data.length > 0 && selectedIds.length === data.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < data.length;

    return (
        <StickyTableWrapper className="rounded-md border border-border bg-card shadow-sm overflow-auto max-h-[65vh]">
            <Table>
                <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableRow className="border-border">
                        <TableHead className="w-[50px] text-center">
                            <Checkbox 
                                checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false} 
                                onCheckedChange={handleSelectAll} 
                                className="translate-y-[2px] border-muted-foreground/50"
                            />
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[180px]">Voucher Info</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[220px]">Payee & Cost Center</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payables / Debits</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right w-[130px]">Voucher Amount</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-sm font-medium text-muted-foreground">Loading pending vouchers...</TableCell></TableRow>
                    ) : data.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-sm font-medium text-muted-foreground">No disbursements pending approval.</TableCell></TableRow>
                    ) : (
                        data.map((d) => (
                            <TableRow key={d.id} className="group hover:bg-primary/[0.04] transition-all duration-200 border-border even:bg-muted/15">
                                <TableCell className="align-top py-4 text-center">
                                    <Checkbox 
                                        checked={selectedIds.includes(d.id)} 
                                        onCheckedChange={(checked) => handleSelectRow(d.id, !!checked)} 
                                        className="translate-y-[2px] border-muted-foreground/50"
                                    />
                                </TableCell>
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-foreground">
                                            <FileText className="w-3.5 h-3.5 text-primary opacity-75" />
                                            <span className="font-black text-xs uppercase tracking-wider">{d.docNo}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                            Date: {d.transactionDate ? format(new Date(d.transactionDate), "MMM dd, yyyy") : "No Date"}
                                        </span>
                                        {d.remarks && (
                                            <span className="text-[9px] font-semibold text-muted-foreground/80 mt-1 uppercase max-w-[170px] truncate" title={d.remarks}>
                                                Remarks: {d.remarks}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1.5 max-w-[200px]">
                                        <span className="text-xs font-black text-foreground uppercase truncate" title={d.payeeName}>
                                            {d.payeeName || "UNKNOWN PAYEE"}
                                        </span>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                                                <Building2 className="w-3 h-3 opacity-60" />
                                                <span className="truncate">{d.divisionName || "No Division"}</span>
                                            </div>
                                            {d.departmentName && (
                                                <span className="text-[8px] font-bold text-muted-foreground/70 uppercase pl-4 truncate">
                                                    {d.departmentName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1.5 max-w-[450px]">
                                        {d.payables && d.payables.length > 0 ? (
                                            d.payables.map((p, idx) => (
                                                <div key={idx} className="flex items-start justify-between text-[10px] bg-muted/30 p-1.5 rounded-lg border border-border/40 gap-4">
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-foreground block truncate max-w-[280px]">
                                                            {p.accountTitle || `COA: ${p.coaId}`}
                                                        </span>
                                                        <span className="text-[8px] text-muted-foreground font-semibold block uppercase mt-0.5">
                                                            Ref: {p.referenceNo || "N/A"} {p.remarks ? `| ${p.remarks}` : ""}
                                                        </span>
                                                    </div>
                                                    <span className="font-black text-foreground shrink-0">{formatCurrency(p.amount)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-[9px] text-muted-foreground italic font-semibold">No payables attached</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4 text-right">
                                    <span className="text-xs font-black text-foreground tracking-wide">
                                        {formatCurrency(d.totalAmount)}
                                    </span>
                                </TableCell>
                                <TableCell className="align-top py-4 text-right pr-4">
                                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary hover:bg-primary/10" onClick={() => onView(d)}>View</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </StickyTableWrapper>
    );
}
