"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Clock, 
  AlertCircle,
  FileSearch
} from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

interface CriticalAlertsProps {
  utilization: { name: string; spent: number; total: number; utilization: number }[];
  pending: { total: number; highPriority: number; value: number };
}

export function CriticalAlerts({ utilization = [], pending }: CriticalAlertsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top Over-Utilized Departments */}
      <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden lg:col-span-2 flex flex-col h-[400px]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
             <AlertTriangle className="h-4 w-4 text-amber-500" />
             <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/70">
               Top Over-Utilized Departments
             </CardTitle>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
             Attention Required
          </span>
        </CardHeader>
        <CardContent className="space-y-5 pt-2 flex-1">
          {utilization.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground uppercase tracking-widest">All Clear</p>
                <p className="text-xs font-medium text-muted-foreground mt-1 max-w-[250px] mx-auto">
                  No department has exceeded the 75% utilization threshold for this period.
                </p>
              </div>
            </div>
          ) : (
            utilization.map((dept, index) => (
              <div key={index} className="space-y-1.5">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-xs font-black text-foreground">{dept.name}</p>
                       <p className="text-[10px] text-muted-foreground font-bold">
                          {formatCurrency(dept.spent)} / {formatCurrency(dept.total)}
                       </p>
                    </div>
                    <div className="text-right">
                       <span className={`text-xs font-black ${dept.utilization >= 100 ? "text-red-500" : "text-amber-600"}`}>
                          {Number(dept.utilization).toFixed(2)}%
                       </span>
                    </div>
                 </div>
                 <div className="relative h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                    <div 
                       className={`h-full transition-all duration-1000 rounded-full ${
                          dept.utilization >= 100 ? "bg-red-500" : "bg-amber-500"
                       }`}
                       style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                    />
                 </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pending Approval Summary */}
      <Card className="rounded-3xl border-border/50 shadow-sm bg-primary text-primary-foreground overflow-hidden flex flex-col relative group h-[400px]">
        {/* Decorative Circle */}
        <div className="absolute -top-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-500" />
        
        <CardHeader className="pb-2 relative">
          <div className="flex items-center gap-2">
             <Clock className="h-4 w-4 text-primary-foreground/80" />
             <CardTitle className="text-sm font-black uppercase tracking-widest text-primary-foreground/80">
               Pending Approvals
             </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between pt-4 relative">
           <div className="space-y-6">
              <div className="space-y-1">
                 <h2 className="text-6xl font-black tracking-tighter leading-none">
                    {pending.total}
                 </h2>
                 <p className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest">
                    Budgets awaiting action
                 </p>
              </div>

              <div className="space-y-3 bg-black/10 p-4 rounded-2xl border border-white/10">
                 <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                       <AlertCircle className="h-3.5 w-3.5 text-red-300" />
                       High Priority
                    </span>
                    <span className="font-black text-red-200">{pending.highPriority}</span>
                 </div>
                 <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-primary-foreground/80">
                       <FileSearch className="h-3.5 w-3.5" />
                       Total Value
                    </span>
                    <span className="font-black">{formatCurrency(pending.value)}</span>
                 </div>
              </div>
           </div>

           <div className="mt-6 flex flex-col gap-4">
              {/* Option 5: Action Required Indicator */}
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-primary-foreground/70">
                    <span>Critical Level</span>
                    <span>{pending.total > 0 ? Math.round((pending.highPriority / pending.total) * 100) : 0}% High Priority</span>
                 </div>
                 <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                    <div 
                       className={`h-full rounded-full transition-all duration-1000 ${pending.highPriority > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                       style={{ width: `${pending.total > 0 ? (pending.highPriority / pending.total) * 100 : 0}%` }}
                    />
                 </div>
              </div>

              {/* Option 3: Mini Sparkline */}
              <div className="h-10 w-full mt-1">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-primary-foreground/50">Activity Trend</span>
                 </div>
                 <svg viewBox="0 0 100 20" className="w-full h-full" preserveAspectRatio="none">
                    <path 
                       d="M0,20 L0,10 C20,15 30,5 50,12 C70,18 80,8 100,5 L100,20 Z" 
                       fill="url(#sparkline-gradient)" 
                    />
                    <path 
                       d="M0,10 C20,15 30,5 50,12 C70,18 80,8 100,5" 
                       fill="none" 
                       stroke="rgba(255,255,255,0.6)" 
                       strokeWidth="1.5"
                       strokeLinecap="round"
                    />
                    <defs>
                       <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                       </linearGradient>
                    </defs>
                 </svg>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
