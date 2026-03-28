// src/modules/financial-management/treasury/bulk-approval/components/ActivityFeed.tsx
"use client";

import * as React from "react";
import { History, Search, FileText, Loader2, Receipt, ArrowRight, Info, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { ActivityLog, ActivityLogDetail } from "../type";
import * as api from "../providers/fetchProvider";

interface Props {
  logs: ActivityLog[];
  loading: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

export function ActivityFeed({ logs, loading }: Props) {
  const [q, setQ] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [details, setDetails] = React.useState<Record<number, ActivityLogDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = React.useState<Record<number, boolean>>({});

  const filteredLogs = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return logs;
    return logs.filter(
      (l) =>
        l.doc_no.toLowerCase().includes(query) ||
        l.payee_name.toLowerCase().includes(query) ||
        (l.remarks ?? "").toLowerCase().includes(query)
    );
  }, [logs, q]);

  function getDraftStatusMeta(draftStatus: string) {
    const s = draftStatus.toLowerCase();
    if (s === "approved") return { label: "Fully Approved", color: "text-emerald-700 bg-emerald-100/80", icon: <CheckCircle2 className="h-3 w-3" /> };
    if (s === "rejected") return { label: "Rejected", color: "text-red-700 bg-red-100/80", icon: <XCircle className="h-3 w-3" /> };
    if (s === "submitted") return { label: "Awaiting L1", color: "text-blue-700 bg-blue-100/80", icon: <Clock className="h-3 w-3" /> };
    const m = s.match(/pending_l(\d+)/);
    if (m) return { label: `Awaiting L${m[1]}`, color: "text-amber-700 bg-amber-100/80", icon: <Clock className="h-3 w-3" /> };
    return { label: draftStatus, color: "text-muted-foreground bg-muted", icon: null };
  }

  async function toggleExpand(id: number, draftId: number) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!details[id]) {
        try {
          setLoadingDetails(prev => ({ ...prev, [id]: true }));
          const data = await api.getActivityLogDetail(draftId);
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

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Feed Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 mb-5 px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
            <History size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-foreground">Approval History</h3>
            <p className="text-xs font-medium text-muted-foreground">
              Finalized disbursement drafts (approved &amp; rejected)
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search docs or payees..."
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
      <div className="flex-1 overflow-auto pr-1 pb-4 space-y-3 rounded-xl relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm font-medium">Loading history…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 border-2 border-dashed rounded-2xl bg-muted/5">
            <Receipt size={40} className="opacity-20" />
            <p className="font-bold text-sm">No finalized activity yet.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const isLoading = loadingDetails[log.id];
            const itemDetails = details[log.id] || [];
            const isApproved = log.vote_status?.toUpperCase() === "APPROVED";
            const draftStatusMeta = getDraftStatusMeta(log.draft_status ?? "");

            return (
              <div
                key={log.id}
                className={`group flex flex-col p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md
                  ${isExpanded
                    ? isApproved
                      ? "bg-emerald-50/50 border-emerald-200 ring-1 ring-emerald-200"
                      : "bg-red-50/50 border-red-200 ring-1 ring-red-200"
                    : "bg-card hover:border-primary/30"}`}
                onClick={() => toggleExpand(log.id, Number(log.draft_id))}
              >
                {/* Main row */}
                <div className="flex justify-between items-start gap-3">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 overflow-hidden">
                    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-black border shadow-sm text-sm
                      ${isApproved
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-red-100 text-red-700 border-red-200"}`}>
                      {log.payee_name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{log.payee_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono">
                        <FileText size={11} className="opacity-60" />
                        <span className="font-semibold text-primary/80">{log.doc_no}</span>
                        <span className="opacity-30">•</span>
                        <span>{format(new Date(log.date_created), "MMM dd, hh:mm a")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount + Status */}
                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className="text-base font-black tracking-tight tabular-nums">
                      {formatCurrency(Number(log.total_amount))}
                    </span>
                    {/* Your vote badge */}
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 gap-1 flex items-center
                        ${isApproved
                          ? "bg-emerald-100/80 text-emerald-700"
                          : "bg-red-100/80 text-red-700"}`}
                    >
                      {isApproved
                        ? <CheckCircle2 className="h-3 w-3" />
                        : <XCircle className="h-3 w-3" />}
                      My Vote: {isApproved ? "Approved" : "Rejected"}
                    </Badge>
                    {/* Current draft status badge */}
                    <Badge
                      variant="secondary"
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 gap-1 flex items-center ${draftStatusMeta.color}`}
                    >
                      {draftStatusMeta.icon}
                      {draftStatusMeta.label}
                    </Badge>
                  </div>
                </div>

                {/* Remarks + Last Approver */}
                <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground italic line-clamp-2 leading-relaxed">
                    &ldquo;{log.remarks || "No supplementary remarks."}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-emerald-500" />
                      Your vote on {format(new Date(log.date_created), "MMM dd, hh:mm a")}
                    </p>
                    <p className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {isExpanded ? "Hide breakdown" : "View breakdown"}
                      <ArrowRight size={10} />
                    </p>
                  </div>
                </div>

                {/* Expanded payable details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <Info size={13} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">Payables Breakdown</span>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-5 gap-2 text-muted-foreground text-xs font-medium">
                        <Loader2 size={15} className="animate-spin text-primary" />
                        Loading line items…
                      </div>
                    ) : (
                      <div className="rounded-xl bg-background/60 border overflow-hidden shadow-inner">
                        {itemDetails.length === 0 ? (
                          <div className="p-4 text-center text-xs italic text-muted-foreground">
                            No line items found.
                          </div>
                        ) : (
                          <>
                            {itemDetails.map((item, idx) => (
                              <div
                                key={item.id}
                                className={`flex justify-between items-center p-3 sm:px-4 hover:bg-muted/30 transition-colors ${idx !== 0 ? "border-t border-border/50" : ""}`}
                              >
                                <div className="flex flex-col min-w-0 pr-4">
                                  <span className="text-[11px] font-bold text-foreground/80 truncate">{item.coa_name}</span>
                                  <span className="text-[10px] text-muted-foreground italic truncate">{item.remarks || "—"}</span>
                                </div>
                                <span className="text-[11px] font-black text-foreground tabular-nums shrink-0">
                                  {formatCurrency(Number(item.amount))}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between items-center p-3 sm:px-4 bg-primary/5 border-t border-primary/10">
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Net Total</span>
                              <span className="text-[12px] font-black text-primary tabular-nums">
                                {formatCurrency(Number(log.total_amount))}
                              </span>
                            </div>
                          </>
                        )}
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
