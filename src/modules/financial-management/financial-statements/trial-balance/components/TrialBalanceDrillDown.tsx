"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Download, RotateCcw } from "lucide-react";
import { TrialBalanceItem } from "../types/trial-balance.schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

/**
 * Drill-down view for a selected Trial Balance account.
 * Currently shows the account header and a placeholder for journal entry lines.
 * Will be connected to a journal-entry-lines API when available.
 */
export function TrialBalanceDrillDown({
  account,
  onBack,
}: {
  account: TrialBalanceItem;
  onBack: () => void;
}) {
  const formatAmount = (val: number) => {
    if (val === 0) return "—";
    return formatCurrency(val);
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Drill Down Header */}
      <div className="flex flex-col gap-4 border-b pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold truncate">
                {account.glCode} - {account.accountTitle}
              </h2>
              <Badge variant="outline" className="shrink-0">
                {account.accountCategory} • {account.accountType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Detailed transaction analysis • {account.balanceType} balance
            </p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Debit Total</p>
              <p className="font-mono font-bold">{formatAmount(account.totalDebit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Credit Total</p>
              <p className="font-mono font-bold text-primary">{formatAmount(account.totalCredit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Net Balance</p>
              <p className="font-mono font-bold">{formatCurrency(account.netBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Filter Panel */}
        <div className="w-64 shrink-0 flex flex-col gap-6">
          <div className="space-y-4 pr-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Workspace Filters</h3>

            <div className="space-y-2">
              <Label htmlFor="je-search" className="text-xs">Search Lines</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input id="je-search" placeholder="Entry ID, memo..." className="h-9 pl-8 text-xs" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-amount" className="text-xs">Minimum Amount</Label>
              <Input id="min-amount" type="number" placeholder="₱0.00" className="h-9 text-xs" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Date Range</Label>
              <div className="grid gap-2">
                <Input type="date" className="h-8 text-xs" defaultValue="2025-01-01" />
                <Input type="date" className="h-8 text-xs" defaultValue="2025-12-30" />
              </div>
            </div>

            <div className="pt-4 border-t flex flex-col gap-2">
              <Button size="sm" variant="outline" className="justify-start gap-2 h-8 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Workspace
              </Button>
              <Button size="sm" variant="secondary" className="justify-start gap-2 h-8 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Right Journal Table - Placeholder for future journal-lines API */}
        <div className="flex-1 min-w-0 border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[120px] font-bold">Journal ID</TableHead>
                <TableHead className="w-[100px] font-bold">Date</TableHead>
                <TableHead className="font-bold">Description</TableHead>
                <TableHead className="w-[120px] text-right font-bold">Debit</TableHead>
                <TableHead className="w-[120px] text-right font-bold">Credit</TableHead>
                <TableHead className="w-[120px] font-bold">Source</TableHead>
                <TableHead className="w-[120px] font-bold">Posted By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Journal entry lines will be loaded here</p>
                    <p className="text-xs">Waiting for journal-lines API integration</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
