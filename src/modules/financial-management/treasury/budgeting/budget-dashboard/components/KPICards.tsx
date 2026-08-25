"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  Wallet, 
  ArrowDownCircle, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import type { DashboardMetrics } from "../services/budgetDashboardService";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

export function KPICards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Active Budget */}
      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card group hover:border-primary/20 transition-all duration-300">
        <CardContent className="p-6 relative">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet className="h-16 w-16 text-primary" />
           </div>
           <div className="space-y-4">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-primary/10 rounded-xl">
                    <TrendingUp className="h-4 w-4 text-primary" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Total Active Budget</span>
              </div>
              <div>
                 <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">
                    {formatCurrency(metrics.totalBudget)}
                 </h2>
                 <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">
                    <span className="text-emerald-500 flex items-center gap-0.5">
                       <ArrowUpRight className="h-3 w-3" /> Real-time
                    </span> 
                    approved budgets
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Total Utilized */}
      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card group hover:border-blue-500/20 transition-all duration-300">
        <CardContent className="p-6 relative">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ArrowDownCircle className="h-16 w-16 text-blue-500" />
           </div>
           <div className="space-y-4">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-blue-500/10 rounded-xl">
                    <ArrowDownCircle className="h-4 w-4 text-blue-500" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Total Utilized</span>
              </div>
              <div>
                 <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">
                    {formatCurrency(metrics.utilized)}
                 </h2>
                 <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">
                     <span className="text-blue-500 flex items-center gap-0.5">
                       <ArrowUpRight className="h-3 w-3" /> {metrics.utilizationRate.toFixed(2)}%
                    </span> 
                    actual utilization
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Remaining Balance */}
      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card group hover:border-emerald-500/20 transition-all duration-300">
        <CardContent className="p-6 relative">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet className="h-16 w-16 text-emerald-500" />
           </div>
           <div className="space-y-4">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Remaining Balance</span>
              </div>
              <div>
                 <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">
                    {formatCurrency(metrics.remaining)}
                 </h2>
                 <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">
                    <span className="text-emerald-500 flex items-center gap-0.5">
                       <ArrowDownRight className="h-3 w-3" /> {Math.max(0, 100 - metrics.utilizationRate).toFixed(2)}%
                    </span> 
                    available funds
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Utilization Rate */}
      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card group hover:border-purple-500/20 transition-all duration-300">
        <CardContent className="p-6 flex items-center justify-between">
           <div className="space-y-4">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-purple-500/10 rounded-xl">
                    <PieChart className="h-4 w-4 text-purple-500" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Utilization Rate</span>
              </div>
              <div>
                 <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">
                    {metrics.utilizationRate.toFixed(2)}%
                 </h2>
                 <p className="text-[10px] text-muted-foreground mt-1 font-bold">
                    System-wide usage
                 </p>
              </div>
           </div>

           {/* Circular Progress Indicator */}
           <div className="relative h-16 w-16 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  className="text-muted/20"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={175.9}
                  strokeDashoffset={175.9 - (175.9 * metrics.utilizationRate) / 100}
                  className="text-purple-600 transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-black text-purple-700">{metrics.utilizationRate.toFixed(2)}%</span>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
