"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Clock, 
  AlertCircle,
  Coins,
  CheckCircle2,
  Flame
} from "lucide-react";

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

interface CriticalAlertsProps {
  utilization: { name: string; spent: number; total: number; utilization: number }[];
  pending: { total: number; highPriority: number; value: number };
}

export function CriticalAlerts({ utilization = [], pending }: CriticalAlertsProps) {
  const highPriorityPercent = pending.total > 0 ? Math.round((pending.highPriority / pending.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top Over-Utilized Departments */}
      <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden lg:col-span-2 flex flex-col h-full min-h-[400px]">
        <CardHeader className="px-6 pt-5 pb-3 flex flex-row items-center justify-between shrink-0 border-b border-border/30 bg-muted/5">
          <div className="flex items-center gap-2.5">
             <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
               <AlertTriangle className="h-4 w-4" />
             </div>
             <div>
               <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground leading-none">
                 Top Over-Utilized Departments
               </CardTitle>
               <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                 Departments reaching critical spending thresholds
               </p>
             </div>
          </div>
          <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
             Threshold &gt; 75%
          </span>
        </CardHeader>

        <CardContent className="p-6 flex-1 flex flex-col justify-center">
          {utilization.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="max-w-[280px]">
                <p className="text-sm font-black text-foreground uppercase tracking-wider">All Systems Operational</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">
                  No department has exceeded the 75% budget utilization threshold for this active period.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {utilization.map((dept, index) => {
                const isCritical = dept.utilization >= 100;
                return (
                  <div key={index} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                           <div className={`w-2 h-2 rounded-full shrink-0 ${isCritical ? "bg-rose-500 animate-ping" : "bg-amber-500"}`} />
                           <p className="text-xs font-black text-foreground truncate">{dept.name}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                           <span className="text-[11px] font-bold text-muted-foreground">
                              {formatCurrencyCompact(dept.spent)} / {formatCurrencyCompact(dept.total)}
                           </span>
                           <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              isCritical ? "bg-rose-500 text-white" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                           }`}>
                              {Number(dept.utilization).toFixed(1)}%
                           </span>
                        </div>
                     </div>
                     <div className="relative h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div 
                           className={`h-full transition-all duration-1000 rounded-full ${
                              isCritical ? "bg-rose-500" : "bg-amber-500"
                           }`}
                           style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                        />
                     </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Approval Summary Card (Strictly Analytics & Visual Only) */}
      <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white overflow-hidden flex flex-col relative group h-full min-h-[400px] p-6 justify-between">
        {/* Ambient Glow Effects */}
        <div className="absolute -top-12 -right-12 h-44 w-44 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-36 w-36 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Card Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
            <Clock className="h-4 w-4 text-blue-200" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Pending Approvals
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-extrabold border border-white/10 text-blue-100">
            <span className={`h-2 w-2 rounded-full ${pending.total > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            {pending.total > 0 ? "ACTION REQUIRED" : "ALL CLEAR"}
          </div>
        </div>

        {/* Hero Counter Area */}
        <div className="relative z-10 my-auto py-4 space-y-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-6xl font-black tracking-tighter leading-none text-white drop-shadow-sm">
                {pending.total}
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200/80">
                Budgets
              </span>
            </div>
            <p className="text-xs font-medium text-blue-100/70 mt-1">
              Currently awaiting executive review & verification
            </p>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 gap-2.5 bg-black/20 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <div className="flex flex-col gap-1 p-2 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-rose-300">
                <Flame className="h-3.5 w-3.5" />
                <span>High Priority</span>
              </div>
              <span className="text-lg font-black text-white leading-none">{pending.highPriority}</span>
            </div>

            <div className="flex flex-col gap-1 p-2 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-blue-200">
                <Coins className="h-3.5 w-3.5" />
                <span>Total Value</span>
              </div>
              <span className="text-sm font-black text-white leading-none truncate" title={formatCurrencyFull(pending.value)}>
                {formatCurrencyCompact(pending.value)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Status Gauge */}
        <div className="relative z-10 space-y-2 pt-2 border-t border-white/10">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-blue-100/80">
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-300" /> Priority Mix
            </span>
            <span className="text-white font-black">{highPriorityPercent}% High Priority</span>
          </div>
          
          <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                pending.highPriority > 0 ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-emerald-400"
              }`}
              style={{ width: `${pending.total > 0 ? Math.max(highPriorityPercent, 5) : 0}%` }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
