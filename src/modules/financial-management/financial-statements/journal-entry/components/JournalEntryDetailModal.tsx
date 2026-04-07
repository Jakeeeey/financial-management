"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { JournalEntryGroup } from "../types";
import { cn, formatCurrency } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Printer, Share2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JournalEntryDetailModalProps {
  group: JournalEntryGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JournalEntryDetailModal({ group, open, onOpenChange }: JournalEntryDetailModalProps) {
  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="bg-background/80 shadow-sm">
                {group.sourceModule} Transaction
            </Badge>
            <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                group.status === "Posted" ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"
            )}>
                {group.status}
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
             Journal Entry Breakdown
             <span className="text-muted-foreground font-light text-xl">|</span>
             <span className="text-indigo-600 font-mono tracking-tighter">{group.jeNo}</span>
          </DialogTitle>
          <DialogDescription className="text-xs pt-1 flex items-center gap-4">
             <span>Created By: <strong>{group.creator || "System Auto"}</strong></span>
             <span>Date: <strong>{format(new Date(group.transactionDate), "PPPP")}</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-8 text-sm">
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Journal Narrative / Description</p>
                <div className="bg-muted/30 p-3 rounded-lg border italic text-slate-700 leading-relaxed">
                   "{group.description}"
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4 h-fit">
                <div className="space-y-1 bg-muted/40 p-2 rounded border border-dashed">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Division</p>
                    <p className="font-semibold">{group.division || "N/A"}</p>
                </div>
                <div className="space-y-1 bg-muted/40 p-2 rounded border border-dashed">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Department</p>
                    <p className="font-semibold">{group.department || "N/A"}</p>
                </div>
             </div>
          </div>

          <Separator />

          <div className="space-y-3">
             <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Accounting Distributions
             </h3>
             <div className="rounded-lg border shadow-inner bg-slate-50/50">
                <Table>
                    <TableHeader className="bg-slate-100/50">
                        <TableRow>
                            <TableHead className="text-[10px] uppercase font-black">Account Group / Title</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-right">Debit</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-right">Credit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {group.entries.map((entry, i) => (
                            <TableRow key={i} className="bg-background">
                                <TableCell className="font-medium text-xs py-3">{entry.accountTitle}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs font-semibold">
                                    {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs font-semibold">
                                    {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          </div>

          {/* Totals Section */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xl shadow-indigo-100/50 flex items-center justify-between">
             <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Balance Summary</p>
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white">{formatCurrency(group.totalDebit)}</span>
                    <span className="text-slate-500 font-thin text-xl">/</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(group.totalCredit)}</span>
                </div>
             </div>
             <div className="text-right">
                {group.isImbalanced ? (
                    <div className="flex flex-col items-end gap-1 px-4 py-2 bg-rose-500/20 border border-rose-500/50 rounded-lg">
                        <span className="text-[10px] font-black text-rose-300 uppercase flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Imbalance Detected
                        </span>
                        <span className="text-xl font-black text-rose-100">{formatCurrency(Math.abs(group.balance))}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-end gap-1 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
                        <span className="text-[10px] font-black text-emerald-300 uppercase flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Fully Balanced
                        </span>
                        <span className="text-xl font-black text-white">0.00</span>
                    </div>
                )}
             </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex sm:justify-between items-center px-6">
            <p className="text-[10px] text-muted-foreground italic">
                Document printed on {format(new Date(), "PPpp")}
            </p>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-8">
                    <Share2 className="mr-2 h-3 w-3" />
                    Share
                </Button>
                <Button size="sm" className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
                    <Printer className="mr-2 h-3 w-3" />
                    Print Entry
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

