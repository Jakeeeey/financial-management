"use client";

import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  User, 
  History, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileText,
  AlertCircle
} from "lucide-react";
import { BudgetAuditTrail } from "../types";
import { getBudgetStatusColor } from "../../budget-creation/utils";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

export function AuditTrailTable({ logs }: { logs: BudgetAuditTrail[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-2xl bg-muted/20">
        <History className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No transaction logs found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div 
          key={log.id}
          className="group relative bg-card border border-border/50 rounded-2xl p-4 transition-all hover:shadow-md hover:border-primary/20"
        >
          {/* Vertical Line Connector (Visual decoration) */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 rounded-l-2xl group-hover:bg-primary/30 transition-colors" />

          <div className="flex flex-col md:flex-row gap-4">
            {/* Left Section: Time & User */}
            <div className="flex flex-col gap-1 w-full md:w-48 shrink-0">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                {format(new Date(log.performed_at), "MMM dd, yyyy · hh:mm a")}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-black truncate">{log.performed_by.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{log.performed_by.role}</p>
                </div>
              </div>
            </div>

            {/* Middle Section: Action & Details */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-6 px-3 text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                  {log.action}
                </Badge>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <p className="text-xs font-bold text-foreground">
                  {log.coa_name}
                </p>
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono bg-muted/50 border-none">
                  {log.gl_code}
                </Badge>
              </div>

              {/* Data Changes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
                {/* Status Change */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status Change</p>
                  <div className="flex items-center gap-2">
                    {log.previous_status && (
                      <>
                        <Badge variant="outline" className={`h-5 text-[9px] opacity-60 ${getBudgetStatusColor(log.previous_status)}`}>
                          {log.previous_status}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                      </>
                    )}
                    <Badge variant="outline" className={`h-5 text-[9px] font-black ${getBudgetStatusColor(log.new_status)}`}>
                      {log.new_status}
                    </Badge>
                  </div>
                </div>

                {/* Amount Change */}
                <div className="flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-border/50 sm:pl-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Amount Change</p>
                  <div className="flex items-center gap-2">
                    {log.previous_amount !== undefined && (
                      <>
                        <span className="text-xs text-muted-foreground line-through opacity-60">{fmt(log.previous_amount)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                      </>
                    )}
                    <span className="text-xs font-black text-foreground">{fmt(log.new_amount)}</span>
                    {log.previous_amount !== undefined && (
                      <div className={`flex items-center gap-0.5 text-[10px] font-bold ${log.new_amount < log.previous_amount ? "text-emerald-600" : "text-amber-600"}`}>
                        {log.new_amount < log.previous_amount ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {Math.abs(((log.new_amount - log.previous_amount) / log.previous_amount) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {log.remarks && (
                <div className="flex gap-2 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-black uppercase text-amber-700/70 tracking-tighter italic">Remarks/Notes</p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">{log.remarks}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Section: Metadata Context */}
            <div className="w-full md:w-32 flex flex-col gap-2 items-end justify-start border-t md:border-t-0 md:border-l border-border/50 md:pl-4 pt-3 md:pt-0">
               <div className="flex flex-col items-end">
                  <p className="text-[10px] font-black text-muted-foreground uppercase">{log.department_name}</p>
                  <p className="text-[9px] text-muted-foreground/60 uppercase">{log.division_name}</p>
               </div>
               <Badge variant="outline" className="h-5 text-[9px] font-bold border-muted-foreground/20">
                  {format(new Date(log.year, log.month - 1), "MMMM yyyy")}
               </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
