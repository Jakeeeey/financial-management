"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  FileSearch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden lg:col-span-2 flex flex-col">
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
        <CardContent className="space-y-5 pt-2">
          {utilization.map((dept, index) => (
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
                        {dept.utilization}%
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
          ))}
        </CardContent>
      </Card>

      {/* Pending Approval Summary */}
      <Card className="rounded-3xl border-border/50 shadow-sm bg-primary text-primary-foreground overflow-hidden flex flex-col relative group">
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

           <Link href="/fm/treasury/budgeting/budget-approval">
              <Button className="w-full mt-8 bg-white text-primary hover:bg-white/90 font-black uppercase tracking-widest text-[10px] h-11 rounded-2xl shadow-xl active:scale-[0.98] transition-all gap-2">
                 View All Requests
                 <ArrowRight className="h-3.5 w-3.5" />
              </Button>
           </Link>
        </CardContent>
      </Card>
    </div>
  );
}
