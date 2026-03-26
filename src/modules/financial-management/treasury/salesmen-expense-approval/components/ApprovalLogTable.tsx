"use client";

import * as React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, Search, FileText, User, Calendar, ChevronDown, ChevronRight, Loader2, Info } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">Recent Approval Logs</h3>
            <p className="text-xs text-muted-foreground italic">
              History of disbursements generated from approved expenses. Click a row to expand details.
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter logs..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setExpandedIds(new Set());
            }}
          />
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-background shadow-sm shadow-primary/5 transition-all hover:shadow-md hover:shadow-primary/10">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-[140px] font-bold text-primary tabular-nums">Doc No</TableHead>
              <TableHead className="font-bold">Transaction Remarks</TableHead>
              <TableHead className="font-bold">Salesman</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Amount</TableHead>
              <TableHead className="font-bold text-center">Date Logged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-10 w-full animate-pulse bg-muted/50 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium italic">
                  No approval history found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedIds.has(log.id);
                const isLoading = loadingDetails[log.id];
                const itemDetails = details[log.id] || [];

                return (
                  <React.Fragment key={log.id}>
                    <TableRow 
                      onClick={() => toggleExpand(log.id)}
                      className={`group hover:bg-primary/5 cursor-pointer transition-colors border-muted/20 ${isExpanded ? 'bg-primary/5' : ''}`}
                    >
                      <TableCell className="text-center">
                        {isExpanded ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} className="opacity-40" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary/80 flex items-center gap-2 tabular-nums py-6">
                        <FileText size={12} className="opacity-40" />
                        {log.doc_no}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            {log.remarks || "No specific remarks provided."}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 font-medium bg-muted/30">
                              Approver: {log.approver_name}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                            <User size={12} />
                          </div>
                          <span className="text-xs font-bold text-foreground/80">{log.salesman_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 h-auto
                            ${log.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                              log.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                              log.status === 'Paid' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              'bg-muted text-muted-foreground'}`}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-primary tabular-nums">
                            {formatCurrency(log.total_amount)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono italic">
                            via {itemDetails.length || "?"} lines
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Calendar size={10} /> {format(new Date(log.date_created), "MMM dd, yyyy")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono opacity-60">
                            {format(new Date(log.date_created), "HH:mm:ss")}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20 border-l-4 border-l-primary/40 hover:bg-muted/20">
                        <TableCell colSpan={7} className="p-0">
                          <div className="px-12 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Info size={14} className="text-primary" />
                              <span className="text-xs font-bold uppercase tracking-tight text-primary/80">Disbursement Payables Breakdown</span>
                            </div>

                            {isLoading ? (
                              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs italic">
                                <Loader2 size={16} className="animate-spin text-primary" />
                                Retrieving nested details from draft record...
                              </div>
                            ) : (
                              <div className="border rounded-lg bg-background overflow-hidden shadow-inner">
                                <Table>
                                  <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="h-8 text-[10px] font-bold">COA / Account Title</TableHead>
                                      <TableHead className="h-8 text-[10px] font-bold">Particulars / Remarks</TableHead>
                                      <TableHead className="h-8 text-[10px] font-bold text-right">Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {itemDetails.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={3} className="h-10 text-center text-[10px] italic text-muted-foreground">
                                          No line items found for this disbursement.
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      itemDetails.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-primary/5 h-8">
                                          <TableCell className="text-[11px] font-bold text-foreground/70">{item.coa_name}</TableCell>
                                          <TableCell className="text-[11px] text-muted-foreground italic">{item.remarks || "—"}</TableCell>
                                          <TableCell className="text-[11px] font-bold text-right text-primary">{formatCurrency(item.amount)}</TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                    <TableRow className="bg-primary/5 font-bold hover:bg-primary/5">
                                      <TableCell colSpan={2} className="text-[11px] text-right text-muted-foreground uppercase">Batch Total</TableCell>
                                      <TableCell className="text-[11px] text-right text-primary">{formatCurrency(log.total_amount)}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
