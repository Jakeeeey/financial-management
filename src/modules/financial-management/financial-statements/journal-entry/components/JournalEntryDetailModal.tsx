"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose,
} from "@/components/ui/dialog";
import { JournalEntryGroup } from "../types";
import { cn, formatNumber } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format } from "date-fns";
import { Clock, ShieldCheck, Link2, Download, Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportJournalToExcel, exportJournalToPdf } from "../services/export.service";
import { toast } from "sonner";

interface JournalEntryDetailModalProps {
  group: JournalEntryGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// MOCK DATA INTERFACES — Ready for real backend data integration
// When the backend provides audit trail and drill-through data, replace the
// mock generation below with props or fetched data. The UI will remain unchanged.
// =============================================================================
interface AuditEntry {
  action: string;
  user: string;
  timestamp: Date;
  note: string;
}

interface DrillThroughContext {
  sourceModule: string;
  sourceReport: string;
  sourceLine: string;
  referenceLink: string;
  postedOnlyView: string;
}

function generateMockAuditTrail(group: JournalEntryGroup): AuditEntry[] {
  const baseDate = new Date(group.transactionDate);
  const time = baseDate.getTime();
  return [
    {
      action: "Create",
      user: group.creator || "System Account",
      timestamp: new Date(time + 1000 * 60 * 60 * 8 + 1000 * 60 * 42),
      note: `Created ${group.entries.length}-line journal entry from ${group.sourceModule}`,
    },
    {
      action: "Submit",
      user: group.creator || "System Account",
      timestamp: new Date(time + 1000 * 60 * 60 * 8 + 1000 * 60 * 45),
      note: "Submitted for approval",
    },
    {
      action: "Approve",
      user: "Joshua Aquino",
      timestamp: new Date(time + 1000 * 60 * 60 * 9 + 1000 * 60 * 3),
      note: "Approved with no changes",
    },
    {
      action: "Post",
      user: "System",
      timestamp: new Date(time + 1000 * 60 * 60 * 9 + 1000 * 60 * 5),
      note: "Posted to General Ledger",
    },
  ];
}

function generateMockDrillThrough(group: JournalEntryGroup): DrillThroughContext {
  return {
    sourceModule: group.sourceModule,
    sourceReport: "Income Statement",
    sourceLine: "Net Sales",
    referenceLink: `${group.sourceModule} Order: SO-1023`,
    postedOnlyView: "No",
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function JournalEntryDetailModal({ group, open, onOpenChange }: JournalEntryDetailModalProps) {
  if (!group) return null;

  const auditTrail = generateMockAuditTrail(group);
  const drillThrough = generateMockDrillThrough(group);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        style={{ maxWidth: '1100px', width: '95vw' }}
        className="w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 border border-border shadow-2xl rounded-xl bg-background [&>button]:hidden"
      >
        
        {/* ── HEADER BAR ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
          <DialogTitle className="text-xl font-bold text-foreground">
            Journal Entry Detail · <span className="font-mono text-muted-foreground">{group.jeNo}</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 text-sm font-semibold gap-1.5"
              onClick={() => {
                try {
                  const dateStr = `Transaction Date: ${format(new Date(group.transactionDate), "MMMM d, yyyy")}`;
                  exportJournalToPdf([group], dateStr, `Journal_Entry_${group.jeNo}.pdf`);
                  toast.success("PDF exported successfully!");
                } catch(e) {
                  toast.error("Failed to export PDF");
                }
              }}
            >
              <Printer className="w-3.5 h-3.5" /> Export PDF
            </Button>
            <Button 
              size="sm" 
              className="h-9 text-sm font-semibold gap-1.5"
              onClick={() => {
                try {
                  const dateStr = `Transaction Date: ${format(new Date(group.transactionDate), "MMMM d, yyyy")}`;
                  exportJournalToExcel([group], dateStr, `Journal_Entry_${group.jeNo}.xlsx`);
                  toast.success("Excel exported successfully!");
                } catch(e) {
                  toast.error("Failed to export Excel");
                }
              }}
            >
              <FileDown className="w-3.5 h-3.5" /> Export Excel
            </Button>
            <DialogClose asChild>
              <Button size="sm" className="h-9 text-sm font-semibold px-4">
                Close
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">

            {/* ── PARAMETER CARDS ROW ── */}
            <div className="flex flex-wrap gap-2">
              <ParamCard label="JE No." value={group.jeNo} />
              <StatusParamCard label="Status" value={group.status} />
              <ParamCard label="Type" value={group.sourceModule.split(" ")[0] || "N/A"} />
              <ParamCard label="Division" value={group.division || "N/A"} />
              <ParamCard label="Department" value={group.department || "N/A"} />
              <ParamCard label="Posting Date" value={format(new Date(group.transactionDate), "yyyy-MM-dd")} />
              <ParamCard label="Creator" value={group.creator || "System"} />
            </div>

            {/* ── TWO COLUMN LAYOUT ── */}
            <div className="flex gap-6 items-start">

              {/* LEFT: Distribution Table */}
              <div className="flex-1 min-w-0 border border-border rounded-lg overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                      <TableHead className="text-xs font-bold text-muted-foreground w-[100px] py-2.5">Account No.</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground py-2.5">Account Title</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground py-2.5">Description</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground py-2.5 text-right">Debit</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground py-2.5 text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.entries.map((e, i) => (
                      <TableRow key={i} className="hover:bg-muted/50 border-b border-border/60">
                        <TableCell className="py-3 text-sm font-mono text-muted-foreground">
                          {e.accountNumber || "N/A"}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-semibold text-foreground">
                          {e.accountTitle}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {group.description}
                          {i === 0 && (
                            <span className="block text-xs italic text-muted-foreground/80 mt-0.5">
                              - {e.accountTitle} distribution
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-semibold tabular-nums text-right">
                          {e.debit > 0 ? `₱${formatNumber(e.debit)}` : ""}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-semibold tabular-nums text-right">
                          {e.credit > 0 ? `₱${formatNumber(e.credit)}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* TOTAL */}
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-2 border-border/80">
                      <TableCell colSpan={3} className="py-3 font-black text-sm text-foreground">TOTAL</TableCell>
                      <TableCell className="py-3 text-right font-black text-sm tabular-nums">
                        ₱{formatNumber(group.totalDebit)}
                      </TableCell>
                      <TableCell className="py-3 text-right font-black text-sm tabular-nums">
                        ₱{formatNumber(group.totalCredit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* RIGHT: Sidebar */}
              <div className="w-[320px] shrink-0 space-y-4">
                
                {/* Drill-through Context */}
                <div className="border border-border rounded-lg p-4 bg-background">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Drill-through Context
                  </h3>
                  <dl className="space-y-2.5 text-xs">
                    <ContextRow label="Source Module:" value={drillThrough.sourceModule} />
                    <ContextRow label="Source Report:" value={drillThrough.sourceReport} />
                    <ContextRow label="Source Line:" value={drillThrough.sourceLine} bold />
                    <ContextRow label="Reference Link:" value={drillThrough.referenceLink} link />
                    <ContextRow label="Posted Only View:" value={drillThrough.postedOnlyView} />
                  </dl>
                </div>

                {/* Audit Trail */}
                <div className="border border-border rounded-lg p-4 bg-background">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Audit Trail
                  </h3>
                  <div className="space-y-0">
                    {auditTrail.map((audit, idx) => (
                      <div key={idx} className="flex gap-3 relative">
                        {/* Vertical line */}
                        <div className="flex flex-col items-center pt-1.5">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            audit.action === "Post" ? "bg-emerald-500" : "bg-muted-foreground/30"
                          )} />
                          {idx < auditTrail.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "text-xs font-bold uppercase px-1.5 py-0.5 rounded",
                              audit.action === "Post"
                                ? "bg-emerald-50 max-dark:bg-emerald-900/30 text-emerald-700 max-dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {audit.action}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {format(audit.timestamp, "yyyy-MM-dd HH:mm")}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-foreground mt-1">{audit.user}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{audit.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ParamCard({ label, value, highlight, className }: { 
  label: string; value: string; highlight?: boolean; className?: string 
}) {
  return (
    <div className={cn(
      "border border-border rounded-lg px-3 py-2 bg-background min-w-[100px]",
      className
    )}>
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn(
        "text-sm mt-0.5",
        highlight ? "font-bold text-foreground" : "font-medium text-foreground/80"
      )}>{value}</div>
    </div>
  );
}

function StatusParamCard({ label, value }: { label: string; value: string }) {
  const statusStr = (value || "").trim();
  const statusLower = statusStr.toLowerCase();
  let statusClasses = "text-slate-700 bg-slate-100 border-slate-200";

  if (statusLower === "approved") statusClasses = "text-blue-700 bg-blue-50 border-blue-200";
  else if (statusLower === "posted") statusClasses = "text-emerald-700 bg-emerald-50 border-emerald-200";
  else if (statusLower === "for review") statusClasses = "text-amber-700 bg-amber-50 border-amber-200";
  else if (statusLower === "draft") statusClasses = "text-slate-700 bg-slate-50 border-slate-200";
  else if (statusLower === "dispatched") statusClasses = "text-indigo-700 bg-indigo-50 border-indigo-200";
  else if (statusLower === "voided" || statusLower === "cancelled") statusClasses = "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <div className="border border-border rounded-lg px-3 py-2 bg-background min-w-[100px] flex flex-col justify-center">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div>
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border", statusClasses)}>
          {value}
        </span>
      </div>
    </div>
  );
}

function ContextRow({ label, value, bold, link }: { 
  label: string; value: string; bold?: boolean; link?: boolean 
}) {
  return (
    <div>
      <dt className="text-muted-foreground font-medium text-xs">{label}</dt>
      <dd className={cn(
        "mt-0.5 text-xs",
        link ? "text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline flex items-center gap-1" : "",
        bold ? "font-bold text-foreground" : "font-medium text-foreground/80"
      )}>
        {value}
        {link && <Link2 className="w-2.5 h-2.5" />}
      </dd>
    </div>
  );
}
