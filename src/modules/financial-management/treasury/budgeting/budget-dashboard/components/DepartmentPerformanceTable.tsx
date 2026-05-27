"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, AlertTriangle, CheckCircle2, Medal } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface DepartmentPerformanceTableProps {
  data: { name: string; allocated: number; actual: number }[];
}

export function DepartmentPerformanceTable({ data }: DepartmentPerformanceTableProps) {
  // Sort by utilization (lowest first = best performance)
  const sortedData = [...data].sort((a, b) => {
    const utilA = a.allocated > 0 ? a.actual / a.allocated : 0;
    const utilB = b.allocated > 0 ? b.actual / b.allocated : 0;
    return utilA - utilB;
  });

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden h-full min-h-[400px] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Trophy className="w-3 h-3 text-amber-500" /> Department Performance Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 pb-4 pt-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Department</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Allocated</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actual Spent</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground/50 text-sm font-medium">
                  No department data found for this period.
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((dept, idx) => {
                const remaining = dept.allocated - dept.actual;
                const utilization = dept.allocated > 0 ? (dept.actual / dept.allocated) * 100 : 0;
                
                let StatusIcon = CheckCircle2;
                let statusColor = "text-emerald-500";
                let badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                let fillClass = "bg-emerald-500/10";

                if (utilization >= 90) {
                  StatusIcon = AlertTriangle;
                  statusColor = "text-rose-500";
                  badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
                  fillClass = "bg-rose-500/10";
                } else if (utilization >= 75) {
                  StatusIcon = AlertTriangle;
                  statusColor = "text-amber-500";
                  badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
                  fillClass = "bg-amber-500/10";
                }

                // Medals for top 3 (lowest utilization)
                const isTop3 = idx < 3;
                let medalColor = "";
                if (idx === 0) medalColor = "text-yellow-500 drop-shadow-md"; // Gold
                if (idx === 1) medalColor = "text-slate-400 drop-shadow-md"; // Silver
                if (idx === 2) medalColor = "text-amber-700 drop-shadow-md"; // Bronze

                return (
                  <TableRow key={dept.name || idx} className={`border-border/40 hover:bg-muted/30 transition-colors group relative ${utilization >= 90 ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}>
                    <TableCell className="font-bold text-xs">
                      <div className="flex items-center gap-2">
                        {isTop3 ? (
                          <Medal className={`w-4 h-4 ${medalColor}`} />
                        ) : (
                          <span className="w-4 text-center text-[10px] text-muted-foreground font-bold">{idx + 1}</span>
                        )}
                        <span className="truncate max-w-[120px] group-hover:text-primary transition-colors">{dept.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatCurrency(dept.allocated)}</TableCell>
                    <TableCell className="text-right text-xs font-black text-foreground relative">
                      {/* Inline Data Bar Background */}
                      <div className="absolute inset-y-1 right-2 left-4 pointer-events-none rounded-sm overflow-hidden opacity-30">
                         <div className={`h-full ${fillClass} transition-all duration-1000 float-right`} style={{ width: `${Math.min(100, utilization)}%` }} />
                      </div>
                      <span className="relative z-10 pr-2">{formatCurrency(dept.actual)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                         <span className="text-xs font-bold text-muted-foreground">{formatCurrency(remaining)}</span>
                         <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                           <StatusIcon className={`w-3 h-3 ${statusColor}`} />
                           {utilization.toFixed(2)}%
                         </div>
                       </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
