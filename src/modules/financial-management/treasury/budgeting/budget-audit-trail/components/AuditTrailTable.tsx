"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  History, 
  FileText,
  Paperclip,
  ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  Download
} from "lucide-react";
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from "@/components/ui/popover";
import { useState } from "react";
import { BudgetAuditTrail } from "../types";
import { getBudgetStatusColor, formatCurrency as fmt } from "../utils";
import { format } from "date-fns";
import { BudgetLifecycleModal } from "./BudgetLifecycleModal";

export function AuditTrailTable({ logs }: { logs: BudgetAuditTrail[] }) {
  const [selectedBudget, setSelectedBudget] = useState<{ id: string; no: string } | null>(null);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-2xl bg-muted/20">
        <History className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No transaction logs found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div 
          key={log.id}
          className="group relative bg-card border border-border/50 rounded-xl p-3 overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
        >
          {/* Status left border accent - thinner for compact look */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
            log.action === 'Created' ? 'bg-emerald-500' :
            log.action === 'Rejected' ? 'bg-rose-500' :
            log.action === 'Approved' ? 'bg-sky-500' :
            'bg-amber-500'
          }`} />

          <div className="flex flex-col gap-2.5">
            {/* COMPACT HEADER: ID, TYPE, TIME, & DEPT */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary/60" />
                <span className="text-[11px] font-black tracking-tight text-foreground uppercase">{log.budget_no}</span>

                <Badge variant="outline" className={`h-3.5 px-1 text-[7px] font-black uppercase tracking-widest ${
                  log.entry_type === 'original' ? 'text-blue-600 border-blue-200 bg-blue-50' : 
                  log.entry_type === 'supplemental' ? 'text-orange-600 border-orange-200 bg-orange-50' :
                  'text-purple-600 border-purple-200 bg-purple-50'
                }`}>
                  {log.entry_type}
                </Badge>

                {/* Attachment Popover embedded directly into log line matching Approval module standards */}
                {log.attachments && log.attachments.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-4 w-5 p-0 hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 rounded-2xl shadow-xl border-border/50 bg-card/95 backdrop-blur-sm" align="start">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                            <Paperclip className="h-3 w-3" />
                            Attachments ({log.attachments.length})
                          </h4>
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                          {log.attachments.map((att: { id: string; directus_id?: string; file_name?: string; file_size?: number; file_type?: string }) => {
                            const isImage = att.file_type?.startsWith("image/");
                            const isExcel = att.file_type?.includes("spreadsheet") || att.file_name?.endsWith(".xlsx") || att.file_name?.endsWith(".xls");
                            const isPdf = att.file_type === "application/pdf" || att.file_name?.endsWith(".pdf");
                            const fileUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${att.directus_id}`;

                            return (
                              <div 
                                key={att.id} 
                                className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors group/item"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`p-1.5 rounded-lg shrink-0 ${
                                    isImage ? 'bg-orange-100 text-orange-600' :
                                    isExcel ? 'bg-emerald-100 text-emerald-600' :
                                    isPdf   ? 'bg-rose-100 text-rose-600' :
                                    'bg-blue-100 text-blue-600'
                                  }`}>
                                    {isImage ? <ImageIcon className="h-3 w-3" /> :
                                     isExcel ? <FileSpreadsheet className="h-3 w-3" /> :
                                     <FileText className="h-3 w-3" />}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold truncate tracking-tight text-foreground/90 leading-none mb-1">
                                      {att.file_name}
                                    </span>
                                    <span className="text-[8px] font-mono opacity-40 uppercase">
                                      {((att.file_size || 0) / 1024).toFixed(1)} KB
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  <a 
                                    href={`${fileUrl}?download`} 
                                    download={att.file_name}
                                    className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                  >
                                    <Download className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {log.entry_type === 'supplemental' && log.parent_budget_no && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBudget({ id: log.parent_budget_id!, no: log.parent_budget_no! });
                    }}
                    className="h-4 px-1.5 text-[7px] font-black uppercase tracking-tighter bg-orange-100/50 text-orange-700 hover:bg-orange-200 hover:text-orange-800 rounded border border-orange-200/50 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <span className="opacity-50">Ref:</span>
                    {log.parent_budget_no}
                  </Button>
                )}

                <span className="text-muted-foreground/30 font-black text-[10px]">·</span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">
                  {format(new Date(log.performed_at), "MMM dd, yyyy · p")}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-tighter bg-muted/40 px-2 py-0.5 rounded border border-border/30">
                <span>{log.division_name}</span>
                <span className="opacity-30">·</span>
                <span>{log.department_name}</span>
              </div>
            </div>

            {/* HORIZONTAL DATA STRIP (COA, Amount, Status) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
              {/* COA */}
              <div className="flex items-center gap-2 min-w-0">
                 <p className="text-[11px] font-black text-foreground tracking-tight truncate uppercase">
                    {log.coa_name}
                 </p>
                 <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-mono font-bold bg-muted/80 text-muted-foreground shrink-0">
                    {log.gl_code}
                 </Badge>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  {log.previous_amount !== null && log.action !== 'Created' && log.previous_amount !== log.new_amount && (
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50 line-through">{fmt(log.previous_amount || 0)}</span>
                  )}
                  <span className="text-xs font-mono font-black tabular-nums text-foreground">{fmt(log.new_amount)}</span>
                  {log.previous_amount !== null && log.action !== 'Created' && log.previous_amount !== log.new_amount && (
                    <div className={`flex items-center gap-0.5 text-[9px] font-bold ${log.new_amount < (log.previous_amount || 0) ? "text-emerald-600" : "text-amber-600"}`}>
                      {log.new_amount < (log.previous_amount || 0) ? "▼" : "▲"}
                      {Math.abs(((log.new_amount - (log.previous_amount || 0)) / (log.previous_amount || 1)) * 100).toFixed(0)}%
                    </div>
                  )}
                </div>

                <span className="hidden md:block w-px h-3 bg-border/40" />

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight opacity-50">Current Status:</span>
                  <Badge className={`h-5 px-2 text-[8px] font-black uppercase tracking-widest shadow-sm ${getBudgetStatusColor(log.live_status)}`}>
                    {log.live_status}
                  </Badge>
                  {log.previous_status && (
                    <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-40 italic">{log.previous_status} →</span>
                  )}
                </div>
              </div>
            </div>

            {/* COMPACT FOOTER: REMARKS & ACTION */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {log.remarks ? (
                  <p className="text-[10px] text-amber-700/80 italic truncate">
                    <span className="font-black uppercase tracking-tighter not-italic mr-1.5 opacity-60">Note:</span>
                    &quot;{log.remarks}&quot;
                  </p>
                ) : (
                  <p className="text-[9px] text-muted-foreground/30 uppercase font-bold tracking-widest italic">No remarks</p>
                )}
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedBudget({ id: log.budget_id, no: log.budget_no })}
                className="h-6 px-2.5 text-[9px] font-black uppercase tracking-tighter gap-1.5 hover:bg-primary/10 hover:text-primary transition-all rounded-md group/btn"
              >
                <History className="h-3 w-3 group-hover/btn:rotate-12 transition-transform" />
                View Lifecycle
              </Button>
            </div>
          </div>
        </div>
      ))}

      {selectedBudget && (
        <BudgetLifecycleModal 
          budgetId={selectedBudget.id}
          budgetNo={selectedBudget.no}
          isOpen={!!selectedBudget}
          onClose={() => setSelectedBudget(null)}
        />
      )}
    </div>
  );
}
