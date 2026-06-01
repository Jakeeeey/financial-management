import React from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceClearedDto } from "../hooks/useCollectionReport";

export function LedgerTable({ invoices, totalCleared }: { invoices: InvoiceClearedDto[], totalCleared: number }) {
    return (
        <Card className="shadow-sm overflow-hidden border border-border h-full flex flex-col">
            <div className="bg-emerald-500/10 py-2.5 px-4 border-b border-emerald-500/20 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">Accounts Settled <ArrowRight size={14}/></h3>
                <span className="text-[9px] font-bold text-muted-foreground">Total: <span className="font-mono text-emerald-700">₱{totalCleared.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
            </div>
            <div className="flex-1 print-expand overflow-y-auto max-h-[800px] scrollbar-thin">
                <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0 shadow-sm z-10"><TableRow><TableHead>Doc No.</TableHead><TableHead>Invoice & Customer</TableHead><TableHead className="text-right">Applied</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {invoices.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center italic text-muted-foreground py-10">No invoices settled in this period.</TableCell></TableRow>
                        ) : invoices.map((inv, i) => (
                            <TableRow key={i} className="hover:bg-muted/50 transition-colors group cursor-default">
                                <TableCell className="py-2 align-top">
                                    <div className="font-bold">{format(parseISO(inv.date), "MM/dd")}</div>
                                    <div className="flex flex-col gap-1 items-start mt-0.5">
                                        <span className="font-mono text-[9px] text-muted-foreground leading-none group-hover:text-foreground transition-colors">{inv.docNo}</span>
                                        {inv.isPosted ? <Badge variant="outline" className="bg-emerald-50/50 text-emerald-600 border-emerald-200 text-[6px] px-1 h-3 leading-none">POSTED</Badge> : <Badge variant="outline" className="bg-orange-50/50 text-orange-600 border-orange-200 text-[6px] px-1 h-3 leading-none">DRAFT</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 align-top">
                                    <div className="flex items-center gap-1.5"><span className="font-black text-primary">{inv.invoiceNo}</span><Badge variant="outline" className="text-[7px] px-1 h-3 leading-none bg-background">{inv.paymentType}</Badge></div>
                                    <div className="text-[9px] text-muted-foreground font-medium mt-0.5">{inv.customerName}</div>
                                </TableCell>
                                <TableCell className="text-right py-2 align-top font-mono font-black text-emerald-600">₱{inv.amountApplied.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}