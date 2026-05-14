"use client";

import React from "react";
import { Disbursement } from "../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Building2, Wallet, Lock } from "lucide-react";

interface DisbursementTableProps {
    data: Disbursement[];
    loading: boolean;
    onView: (d: Disbursement) => void;
}

export function DisbursementTable({ data, loading, onView }: DisbursementTableProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case "DRAFT": return "bg-muted text-muted-foreground border-border";
            case "SUBMITTED": return "bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
            case "APPROVED": return "bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
            case "RELEASED": return "bg-purple-100/50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
            case "POSTED": return "bg-primary text-primary-foreground border-primary";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[180px]">Voucher Info</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payee & Particulars</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cost Center</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Financials</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center w-[120px]">Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-sm font-medium text-muted-foreground">Loading vouchers...</TableCell></TableRow>
                    ) : data.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-sm font-medium text-muted-foreground">No disbursements found in this category.</TableCell></TableRow>
                    ) : (
                        data.map((d) => (
                            <TableRow key={d.id} className="group hover:bg-muted/50 transition-colors border-border">
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-foreground">
                                            <FileText className={`w-3.5 h-3.5 ${d.isPosted === 1 ? 'text-foreground' : 'text-primary'} opacity-70`} />
                                            <span className="font-bold text-xs uppercase">{d.docNo}</span>
                                            {d.isPosted === 1 && (
                                                <span title="Locked & Posted"><Lock className="w-3 h-3 text-destructive ml-1" /></span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                            {d.transactionDate ? format(new Date(d.transactionDate), "MMM dd, yyyy") : "No Date"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1 max-w-[300px]">
                                        <span className="text-xs font-black text-foreground uppercase truncate">{d.payeeName || "UNKNOWN PAYEE"}</span>
                                        <span className="text-[10px] font-medium text-muted-foreground truncate" title={d.remarks}>{d.remarks || "No particulars provided"}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-foreground/80">
                                            <Building2 className="w-3 h-3 opacity-50" />
                                            <span className="text-[10px] font-bold uppercase truncate">{d.divisionName || "No Division"}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase ml-4.5 truncate">{d.departmentName || "No Department"}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4 text-right">
                                    <div className="flex flex-col gap-1 items-end">
                                        <span className="text-xs font-black text-foreground">{formatCurrency(d.totalAmount)}</span>
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-500">
                                            <Wallet className="w-3 h-3" /> Paid: {formatCurrency(d.paidAmount || 0)}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top py-4 text-center">
                                    <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 py-0.5 ${getStatusColor(d.status)}`}>{d.status}</Badge>
                                </TableCell>
                                <TableCell className="align-top py-4 text-right pr-4">
                                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary hover:bg-primary/10" onClick={() => onView(d)}>View</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}