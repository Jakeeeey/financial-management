import React from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckDetailDto, VarianceDetailDto } from "../hooks/useCollectionReport";

export function DepositsTable({ checks }: { checks: CheckDetailDto[] }) {
    return (
        <Card className="shadow-sm overflow-hidden border border-border">
            <div className="bg-blue-500/10 py-2.5 px-4 border-b border-blue-500/20">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-700 flex items-center gap-1.5"><ArrowLeft size={14}/> Deposits (Checks)</h3>
            </div>
            <div className="print-expand overflow-y-auto max-h-[350px] scrollbar-thin">
                <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0 shadow-sm z-10"><TableRow><TableHead>Date / Doc</TableHead><TableHead>Bank & Check No.</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {checks.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center italic text-muted-foreground py-6">No checks recorded.</TableCell></TableRow>
                        ) : checks.map((chk, i) => (
                            <TableRow key={i} className="hover:bg-muted/50 transition-colors group">
                                <TableCell className="py-2 align-top">
                                    <div className="font-bold">{format(parseISO(chk.date), "MM/dd")}</div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">{chk.docNo}</span>
                                        {chk.isPosted ? <Badge variant="outline" className="bg-emerald-50/50 text-emerald-600 border-emerald-200 text-[6px] px-1 h-3 leading-none">POSTED</Badge> : <Badge variant="outline" className="bg-orange-50/50 text-orange-600 border-orange-200 text-[6px] px-1 h-3 leading-none">DRAFT</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="py-2"><div className="font-bold">{chk.bankName}</div><div className="text-[9px] font-mono text-muted-foreground">{chk.checkNo}</div></TableCell>
                                <TableCell className="text-right py-2 font-mono font-black">₱{chk.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}

export function VariancesTable({ variances }: { variances: VarianceDetailDto[] }) {
    return (
        <Card className="shadow-sm overflow-hidden border border-border mt-4">
            <div className="bg-muted/30 py-2.5 px-4 border-b border-border/50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Scale size={14}/> Adjustments / Variances</h3>
            </div>
            <div className="print-expand overflow-y-auto max-h-[350px] scrollbar-thin">
                <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0 shadow-sm z-10"><TableRow><TableHead>Doc No.</TableHead><TableHead>Account / Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {variances.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center italic text-muted-foreground py-6">No variances logged.</TableCell></TableRow>
                        ) : variances.map((v, i) => (
                            <TableRow key={i} className="hover:bg-muted/50 transition-colors group">
                                <TableCell className="py-2 align-top">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className="font-mono text-[9px] text-muted-foreground leading-none group-hover:text-foreground transition-colors">{v.docNo}</span>
                                        <div className="flex gap-1">
                                            {v.isPosted ? <Badge variant="outline" className="bg-emerald-50/50 text-emerald-600 border-emerald-200 text-[6px] px-1 h-3 leading-none">POSTED</Badge> : <Badge variant="outline" className="bg-orange-50/50 text-orange-600 border-orange-200 text-[6px] px-1 h-3 leading-none">DRAFT</Badge>}
                                            <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3 leading-none ${v.type.includes('Shortage') ? 'border-red-200 text-red-600 bg-red-50' : 'border-purple-200 text-purple-600 bg-purple-50'}`}>{v.type}</Badge>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-2"><div className="font-bold">{v.accountTitle}</div><div className="text-[9px] text-muted-foreground truncate max-w-[200px]">{v.remarks}</div></TableCell>
                                <TableCell className="text-right py-2 font-mono font-black">₱{v.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}