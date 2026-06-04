"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  User, 
  ArrowRight, 
  Layers,
  CalendarDays,
  FileText
} from "lucide-react";
import { type BudgetAuditTrail } from "../types";
import { auditTrailService } from "../services/auditTrailService";
import { getBudgetStatusColor, formatCurrency as fmt } from "../utils";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface BudgetLifecycleModalProps {
  budgetId: string;
  budgetNo: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BudgetLifecycleModal({ budgetId, budgetNo, isOpen, onClose }: BudgetLifecycleModalProps) {
  const [lifecycle, setLifecycle] = useState<BudgetAuditTrail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && budgetId) {
      const fetchLifecycle = async () => {
        setLoading(true);
        try {
          const data = await auditTrailService.getBudgetLifecycle(budgetId);
          setLifecycle(data);
        } catch (error) {
          console.error("Failed to fetch lifecycle:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchLifecycle();
    }
  }, [isOpen, budgetId]);

  // Use the first log as reference for header (Original creation context)
  const referenceLog = lifecycle[0];
  const latestLog = lifecycle[lifecycle.length - 1];
  const contextLog = referenceLog || latestLog;
  const displayValue = (value?: string | null) => {
    if (!value || value === "â€”") return "-";
    return value;
  };
  const coaContext = contextLog
    ? `${contextLog.gl_code && contextLog.gl_code !== "â€”" ? `${contextLog.gl_code} - ` : ""}${displayValue(contextLog.coa_name)}`
    : "-";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl gap-0 border-border/40 shadow-2xl">
        <DialogHeader className="p-6 bg-muted/20 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
               <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase leading-none">
                Budget Lifecycle
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                Full Transaction History Timeline
              </DialogDescription>
            </div>
          </div>
          
          {(referenceLog || latestLog) && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 rounded-xl border border-border/30 bg-background/45 px-3 py-2 text-[10px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">Division</p>
                  <p className="truncate font-bold uppercase tracking-tight text-foreground/70" title={displayValue(contextLog?.division_name)}>
                    {displayValue(contextLog?.division_name)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">Department</p>
                  <p className="truncate font-bold uppercase tracking-tight text-foreground/70" title={displayValue(contextLog?.department_name)}>
                    {displayValue(contextLog?.department_name)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">COA</p>
                  <p className="truncate font-bold uppercase tracking-tight text-foreground/70" title={coaContext}>
                    {coaContext}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-lg border border-border/50 shadow-sm">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-black tracking-tight">{budgetNo}</span>
              </div>
              <Badge variant="outline" className={`h-6 px-3 text-[10px] font-black uppercase tracking-widest ${
                (latestLog?.entry_type || referenceLog?.entry_type) === 'original' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                (latestLog?.entry_type || referenceLog?.entry_type) === 'supplemental' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {latestLog?.entry_type || referenceLog?.entry_type || 'original'}
              </Badge>
              <div className="flex items-center gap-1.5 ml-auto">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {latestLog?.year && latestLog?.month ? format(new Date(latestLog.year, latestLog.month - 1), "MMMM yyyy") : "—"}
                </span>
              </div>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-muted">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : lifecycle.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Layers className="h-12 w-12 mb-4" />
              <p className="text-sm font-bold">No history available for this budget.</p>
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:inset-0 before:ml-[19px] before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-border/50 before:to-transparent">
              {lifecycle.map((log, idx) => (
                <div key={log.id} className="relative flex items-start gap-4 group">
                  {/* Timeline Node */}
                  <div className={`mt-0.5 flex items-center justify-center h-10 w-10 rounded-full border-4 border-background shrink-0 z-10 transition-transform group-hover:scale-110 shadow-sm ${
                    idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <div className="h-2 w-2 rounded-full bg-current" />
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 space-y-2.5 bg-card border border-border/50 p-3 rounded-2xl shadow-sm hover:border-primary/20 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                         <Badge className={`h-5 text-[9px] font-black uppercase tracking-widest ${getBudgetStatusColor(log.new_status)}`}>
                            {log.action}
                         </Badge>
                         <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            {format(new Date(log.performed_at), "MMM dd · hh:mm a")}
                         </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{log.performed_by.name}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 py-2 border-y border-border/30 relative grid-cols-1 sm:grid-cols-2">
                       {(() => {
                         const hasPreviousAmount = log.previous_amount !== null && log.previous_amount !== undefined;
                         const amountChanged = hasPreviousAmount && log.previous_amount !== log.new_amount;

                         return (
                           <div className="space-y-1">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                {amountChanged ? "Amount Change" : "Amount"}
                              </p>
                              <div className="flex items-center gap-2">
                                 {amountChanged && (
                                    <>
                                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground line-through opacity-50">{fmt(log.previous_amount || 0)}</span>
                                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />
                                    </>
                                 )}
                                 <span className="text-xs font-mono font-black tabular-nums">{fmt(log.new_amount)}</span>
                              </div>
                           </div>
                         );
                       })()}

                       <div className="hidden sm:block absolute left-1/2 top-2 bottom-2 w-px bg-border/40 -translate-x-px" />

                       <div className="space-y-1 sm:pl-3">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</p>
                          <div className="flex items-center gap-2">
                             {log.previous_status && (
                                <>
                                  <Badge variant="outline" className={`h-4 text-[8px] opacity-50 ${getBudgetStatusColor(log.previous_status)}`}>
                                     {log.previous_status}
                                  </Badge>
                                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />
                                </>
                             )}
                             <Badge variant="outline" className={`h-4 text-[8px] font-bold ${getBudgetStatusColor(log.new_status)}`}>
                                {log.new_status}
                             </Badge>
                          </div>
                       </div>
                    </div>

                    {log.remarks && (
                       <div className="flex gap-2 text-[11px] italic text-muted-foreground/80 leading-relaxed bg-muted/30 p-2 rounded-xl border border-border/30">
                          <span className="font-bold uppercase text-[8px] tracking-tighter opacity-60">Note:</span>
                          <p>{log.remarks}</p>
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
