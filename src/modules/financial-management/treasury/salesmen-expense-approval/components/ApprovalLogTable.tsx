"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { 
  History, Search, FileText, Loader2, Info, 
  CheckCircle2, Receipt, ArrowRight, TrendingUp, TrendingDown, Clock, User
} from "lucide-react";
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

  function formatDateTime(d: string) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-PH", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Feed Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-inner">
            <History size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground">Activity Feed</h3>
            <p className="text-[10px] font-medium text-muted-foreground">
              Recent treasury disbursements & approvals
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search docs or names..."
            className="w-full pl-8 pr-3 h-8 text-xs bg-muted/30 border-transparent focus:border-primary focus:bg-background rounded-lg outline-none ring-0 transition-all font-medium"
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
                className={`group flex flex-col p-3 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md
                  ${isExpanded ? 'bg-primary/[0.02] border-primary/20 ring-1 ring-primary/20' : 'bg-card hover:border-primary/30'}
                `}
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex justify-between items-start gap-4">
                  
                  {/* Left: User & Main Info */}
                  <div className="flex items-start gap-3 flex-1 overflow-hidden">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-xs font-black border border-primary/10 shadow-sm">
                      {log.salesman_name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-bold text-xs text-foreground truncate flex items-center gap-2">
                        {log.salesman_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground font-mono">
                        <FileText size={10} className="opacity-60" />
                        <span className="font-semibold text-primary/80">{log.doc_no}</span>
                        <span className="opacity-30">•</span>
                        <span>{format(new Date(log.date_created), "MMM dd, hh:mm a")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Status */}
                  <div className="flex flex-col items-end shrink-0 gap-1 mt-0.5">
                    <span className="text-base font-black tracking-tight tabular-nums text-foreground drop-shadow-sm">
                      {formatCurrency(log.total_amount)}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 max-w-[100px] truncate
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
                <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col gap-1.5">
                   <p className="text-[11px] font-medium text-muted-foreground italic line-clamp-2 leading-tight">
                     &quot;{log.remarks || "No supplementary remarks provided."}&quot;
                   </p>
                   <div className="flex items-center justify-between">
                     <p className="text-[9px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5">
                       <CheckCircle2 size={10} className="text-emerald-500" /> 
                       Submitted by {log.approver_name}
                     </p>
                     <p className="text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {isExpanded ? "Close details" : "View breakdown"} <ArrowRight size={8} />
                     </p>
                   </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    {/* Treasury Updates (Votes) */}
                    {log.votes && log.votes.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <History size={14} className="text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest text-primary">Approval Narrative</span>
                        </div>
                        <div className="space-y-2">
                          {log.votes.map((v, i) => (
                             <div key={i} className={`p-3 rounded-xl border transition-colors shadow-sm ${v.status === 'APPROVED' ? 'bg-emerald-500/5 border-emerald-500/20' : v.status === 'REJECTED' ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border/50'}`}>
                               <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${v.status === 'APPROVED' ? 'bg-emerald-500' : v.status === 'REJECTED' ? 'bg-destructive' : 'bg-muted-foreground'}`}></div>
                                    {v.approver_name} <span className="opacity-50 font-medium">(Round {v.version})</span>
                                  </span>
                                  <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0 ${v.status === 'APPROVED' ? 'text-emerald-600 border-emerald-200 bg-emerald-100/50' : v.status === 'REJECTED' ? 'text-destructive border-destructive/20 bg-destructive/10' : 'text-muted-foreground border-muted'}`}>
                                    {v.status}
                                  </Badge>
                               </div>
                               {v.remarks && <p className="text-[11px] font-medium text-muted-foreground italic leading-tight pl-3 relative before:content-[''] before:w-0.5 before:bg-muted before:absolute before:left-0 before:top-1 before:bottom-0">"{v.remarks}"</p>}
                               <p className="text-[8px] text-muted-foreground/40 font-bold mt-1.5 pl-3">{formatDateTime(v.created_at)}</p>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}

                    {/* Treasury Updates Card Grid (Revisions) */}
                    {(log.logs && log.logs.length > 0) || (log.expense_logs && log.expense_logs.length > 0) ? (
                      <div className="mb-6 space-y-4">
                        {/* 1. Overall Draft Revisions (Variances) */}
                        {log.logs && log.logs.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                              <History size={14} className="text-primary/70" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Amount Adjustments</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                              {log.logs.map((rev) => {
                                const variance = rev.new_total - rev.old_total;
                                const isIncrease = variance > 0;
                                const isDecrease = variance < 0;
                                return (
                                  <div key={rev.id} className="min-w-[200px] max-w-[240px] border bg-background rounded-xl p-3 shrink-0 flex flex-col gap-2 shadow-sm border-primary/5">
                                    <div className="flex justify-between items-start">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">{rev.editor_name}</span>
                                      <div className={`shrink-0 flex items-center gap-1 text-[7px] uppercase font-black px-1 py-0.5 rounded
                                        ${isIncrease ? 'bg-rose-50 text-rose-600' : isDecrease ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                        {isIncrease ? <TrendingUp size={8} /> : isDecrease ? <TrendingDown size={8} /> : <ArrowRight size={8} />}
                                        {isIncrease ? 'Up' : isDecrease ? 'Down' : 'Same'}
                                      </div>
                                    </div>
                                    <p className="text-[10px] font-medium italic text-muted-foreground line-clamp-2 border-l-2 border-primary/10 pl-2">
                                      "{rev.edit_reason}"
                                    </p>
                                    <div className="mt-1 flex items-center justify-between border-t pt-2 border-dashed">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black tabular-nums text-foreground">
                                          {formatCurrency(rev.new_total)}
                                        </span>
                                        <span className="text-[7px] text-muted-foreground/40 font-bold">{formatDateTime(rev.created_at)}</span>
                                      </div>
                                      <span className={`text-[8px] font-bold ${isIncrease ? 'text-rose-500' : isDecrease ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                        {isIncrease ? '+' : ''}{formatCurrency(variance)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Itemized Expense Revisions */}
                        {log.expense_logs && log.expense_logs.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                              <FileText size={14} className="text-amber-600/70" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600/70">Itemized Revisions</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                              {log.expense_logs.map((exRev) => (
                                <div key={exRev.id} className="min-w-[180px] max-w-[220px] border border-amber-100 bg-amber-50/5 rounded-xl p-3 shrink-0 flex flex-col gap-1.5 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-black text-amber-700/60 uppercase truncate max-w-[80px]">{exRev.editor_name}</span>
                                    <span className="text-[7px] font-bold text-muted-foreground/40 uppercase">{exRev.action}</span>
                                  </div>
                                  <p className="text-[9px] font-black text-foreground/80 line-clamp-1">{exRev.particulars}</p>
                                  <div className="flex justify-between items-center">
                                    <p className="text-[11px] font-black text-primary">{formatCurrency(exRev.amount)}</p>
                                    <span className="text-[7px] text-muted-foreground/40 font-bold">{formatDateTime(exRev.changed_at)}</span>
                                  </div>
                                  {exRev.remarks && <p className="text-[8px] italic text-muted-foreground line-clamp-1 border-l border-amber-200 pl-1.5 opacity-70">"{exRev.remarks}"</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

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
