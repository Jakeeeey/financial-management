"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { History, Search, FileText, Loader2, Info, CheckCircle2, Receipt, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import type { ApprovalLog, ApprovalLogDetail } from "../type";
import * as api from "../providers/fetchProvider";

interface ApprovalLogTableProps {
  logs: ApprovalLog[];
  loading: boolean;
}

export function ApprovalLogTable({ logs, loading }: ApprovalLogTableProps) {
  const [q, setQ] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [details, setDetails] = React.useState<Record<number, ApprovalLogDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = React.useState<Record<number, boolean>>({});

  const filteredLogs = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return logs;
    return logs.filter(
      (l) =>
        l.doc_no.toLowerCase().includes(query) ||
        l.salesman_name.toLowerCase().includes(query) ||
        l.remarks?.toLowerCase().includes(query)
    );
  }, [logs, q]);

  async function toggleExpand(id: number) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!details[id]) {
        try {
          setLoadingDetails(prev => ({ ...prev, [id]: true }));
          const data = await api.getApprovalLogDetails(id);
          setDetails(prev => ({ ...prev, [id]: data }));
        } catch (e) {
          console.error("Failed to load log details", e);
        } finally {
          setLoadingDetails(prev => ({ ...prev, [id]: false }));
        }
      }
    }
    setExpandedIds(next);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Feed Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 mb-6 px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
            <History size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-foreground">Activity Feed</h3>
            <p className="text-xs font-medium text-muted-foreground">
              Recent treasury disbursements & approvals
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search docs or names..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted/30 border-transparent focus:border-primary focus:bg-background rounded-xl outline-none ring-0 transition-all font-medium"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setExpandedIds(new Set());
            }}
          />
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-auto pr-2 pb-4 space-y-4 rounded-xl custom-scrollbar relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm font-medium">Syncing history...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 border-2 border-dashed rounded-2xl bg-muted/5">
             <Receipt size={40} className="opacity-20" />
             <p className="font-bold text-sm">No recent activity</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const isLoading = loadingDetails[log.id];
            const itemDetails = details[log.id] || [];

            return (
              <div 
                key={log.id} 
                className={`group flex flex-col p-4 md:p-5 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md
                  ${isExpanded ? 'bg-primary/[0.02] border-primary/20 ring-1 ring-primary/20' : 'bg-card hover:border-primary/30'}
                `}
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex justify-between items-start gap-4">
                  
                  {/* Left: User & Main Info */}
                  <div className="flex items-start gap-4 flex-1 overflow-hidden">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-black border border-primary/10 shadow-sm">
                      {log.salesman_name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-bold text-sm text-foreground truncate flex items-center gap-2">
                        {log.salesman_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono">
                        <FileText size={12} className="opacity-60" />
                        <span className="font-semibold text-primary/80">{log.doc_no}</span>
                        <span className="opacity-30">•</span>
                        <span>{format(new Date(log.date_created), "MMM dd, hh:mm a")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Status */}
                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className="text-lg font-black tracking-tight tabular-nums text-foreground drop-shadow-sm">
                      {formatCurrency(log.total_amount)}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 max-w-[120px] truncate
                        ${log.status === 'Draft' ? 'bg-amber-100/50 text-amber-700' : 
                          log.status === 'Submitted' ? 'bg-indigo-100/50 text-indigo-700' :
                          log.status === 'Approved' ? 'bg-emerald-100/50 text-emerald-700' : 
                          'bg-primary/10 text-primary'}`}
                    >
                      {log.status}
                    </Badge>
                  </div>
                </div>

                {/* Remarks & Approver Banner */}
                <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-2">
                   <p className="text-xs font-medium text-muted-foreground italic line-clamp-2 leading-relaxed">
                     &quot;{log.remarks || "No supplementary remarks provided."}&quot;
                   </p>
                   <div className="flex items-center justify-between">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5">
                       <CheckCircle2 size={12} className="text-emerald-500" /> 
                       Submitted by {log.approver_name}
                     </p>
                     <p className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {isExpanded ? "Close details" : "View breakdown"} <ArrowRight size={10} />
                     </p>
                   </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <Info size={14} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">Payables Allocation Breakdown</span>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs font-medium">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        Retrieving nested records...
                      </div>
                    ) : (
                      <div className="rounded-xl bg-background/50 border overflow-hidden shadow-inner">
                        <div className="flex flex-col">
                          {itemDetails.length === 0 ? (
                            <div className="p-4 text-center text-xs italic text-muted-foreground font-medium">
                              No discrete line items indexed.
                            </div>
                          ) : (
                            itemDetails.map((item, idx) => (
                              <div key={item.id} className={`flex justify-between items-center p-3 sm:px-4 ${idx !== 0 ? 'border-t border-border/50' : ''} hover:bg-muted/30 transition-colors`}>
                                <div className="flex flex-col min-w-0 pr-4">
                                  <span className="text-[11px] font-bold text-foreground/80 truncate">{item.coa_name}</span>
                                  <span className="text-[10px] text-muted-foreground italic truncate">{item.remarks || "—"}</span>
                                </div>
                                <span className="text-[11px] font-black text-foreground tabular-nums shrink-0">
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                            ))
                          )}
                          <div className="flex justify-between items-center p-3 sm:px-4 bg-primary/5 border-t border-primary/10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Net Processed</span>
                            <span className="text-[12px] font-black text-primary tabular-nums">
                              {formatCurrency(log.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
