"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogClose,
} from "@/components/ui/dialog";
import { JournalEntryGroup } from "../types";
import { cn } from "@/lib/utils";
import { formatJournalAmount } from "../utils/formatters";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format } from "date-fns";
import { Clock, ShieldCheck, Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportJournalToExcel, exportJournalToPdf } from "../services/export.service";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { adjustingJournalEntriesApi } from "../../adjusting-journal-entries/services/adjusting-journal-entries.api";
import { AdjustingEntry } from "../../adjusting-journal-entries/types";

interface JournalEntryDetailModalProps {
  group: JournalEntryGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
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

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function JournalEntryDetailModal({ group, open, onOpenChange, onRestoreFocus }: JournalEntryDetailModalProps) {
  const [drillThrough, setDrillThrough] = React.useState<DrillThroughContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [linkedAjes, setLinkedAjes] = React.useState<AdjustingEntry[]>([]);
  const [isLoadingAjes, setIsLoadingAjes] = React.useState(false);

  React.useEffect(() => {
    if (open && group?.jeNo) {
      let isMounted = true;
      setIsLoading(true);
      setIsLoadingAjes(true);
      
      const fetchDrillDown = async () => {
        try {
          const res = await fetch(`/api/fm/financial-statements/journal-entry/drill-down?jeNo=${group.jeNo}`);
          if (!res.ok) throw new Error("Failed to fetch drill-down context.");
          const data = await res.json();
          if (isMounted) {
            setDrillThrough(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };

      const fetchLinkedAjes = async () => {
        try {
          const res = await adjustingJournalEntriesApi.list({
            page: 0,
            pageSize: 50,
            status: "Posted",
            sourceJeNo: group.jeNo,
          });
          if (isMounted) {
            setLinkedAjes(res.content ?? []);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (isMounted) setIsLoadingAjes(false);
        }
      };

      fetchDrillDown();
      fetchLinkedAjes();
      
      return () => { isMounted = false; };
    } else {
       setDrillThrough(null);
       setLinkedAjes([]);
    }
  }, [group, open]);

  if (!group) return null;

  const ajeTotalDebit = linkedAjes.reduce((sum, aje) => sum + aje.totalDebit, 0);
  const ajeTotalCredit = linkedAjes.reduce((sum, aje) => sum + aje.totalCredit, 0);

  // Audit trail is empty for now, ready for real data integration
  const auditTrail: AuditEntry[] = [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        style={{ maxWidth: '1100px', width: '95vw' }}
        className="w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 border border-border shadow-2xl rounded-xl bg-background [&>button]:hidden"
      >
        
        {/* ── HEADER BAR ── */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <DialogTitle className="min-w-0 break-words text-lg font-bold text-foreground sm:text-xl">
            Journal Entry Detail · <span className="font-mono text-muted-foreground">{group.jeNo}</span>
          </DialogTitle>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 text-sm font-semibold gap-1.5"
              onClick={() => {
                try {
                  const dateStr = `Transaction Date: ${format(new Date(group.transactionDate), "MMMM d, yyyy")}`;
                  exportJournalToPdf([group], dateStr, `Journal_Entry_${group.jeNo}.pdf`, linkedAjes);
                  toast.success("PDF exported successfully!");
                } catch {
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
                  exportJournalToExcel([group], dateStr, `Journal_Entry_${group.jeNo}.xlsx`, linkedAjes);
                  toast.success("Excel exported successfully!");
                } catch {
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
          <div className="space-y-6 p-4 sm:p-6">

            {/* ── PARAMETER CARDS ROW ── */}
            <div className="flex flex-wrap gap-2">
              <ParamCard label="JE No." value={group.jeNo} loading={isLoading} />
              <StatusParamCard label="Status" value={group.status} loading={isLoading} />
              <ParamCard label="Type" value={group.sourceModule.split(" ")[0] || "N/A"} loading={isLoading} />
              <ParamCard label="Division" value={group.division || "N/A"} loading={isLoading} />
              <ParamCard label="Department" value={group.department || "N/A"} loading={isLoading} />
              <ParamCard label="Transaction Date" value={format(new Date(group.transactionDate), "yyyy-MM-dd")} loading={isLoading} />
              <ParamCard label="Posting Date" value={group.postingDate ? format(new Date(group.postingDate), "yyyy-MM-dd") : "Not posted"} loading={isLoading} />
              <ParamCard label="Creator" value={group.creator || "System"} loading={isLoading} />
            </div>

            {/* ── JOURNAL DETAILS AND CONTEXT ── */}
            <div className="grid min-w-0 grid-cols-1 items-start gap-6">

              {/* Journal distribution */}
              <div className="hidden min-w-0 rounded-lg border border-border bg-background lg:block">
                <Table className="table-fixed w-full min-w-[860px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                      <TableHead className="w-[100px] py-2.5 text-xs font-bold text-muted-foreground">Account No.</TableHead>
                      <TableHead className="w-[220px] py-2.5 text-xs font-bold text-muted-foreground">Account Title</TableHead>
                      <TableHead className="w-[280px] py-2.5 text-xs font-bold text-muted-foreground">Description</TableHead>
                      <TableHead className="w-[130px] py-2.5 text-right text-xs font-bold text-muted-foreground">Debit</TableHead>
                      <TableHead className="w-[130px] py-2.5 text-right text-xs font-bold text-muted-foreground">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      <TableRow className="bg-blue-50/60 hover:bg-blue-50/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/20">
                        <TableCell colSpan={5} className="py-2 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                          Original Journal
                        </TableCell>
                      </TableRow>
                      {isLoading ? (
                        Array.from({ length: Math.max(3, group.entries.length) }).map((_, i) => (
                          <TableRow key={`sk-${i}`} className="hover:bg-muted/50 border-b border-border/60">
                            <TableCell className="py-3"><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell className="py-3"><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell className="py-3">
                              <Skeleton className="h-4 w-full max-w-[200px]" />
                              {i === 0 && <Skeleton className="h-3 w-32 mt-1.5" />}
                            </TableCell>
                            <TableCell className="py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell className="py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : (
                        group.entries.map((e, i) => (
                          <TableRow key={i} className="hover:bg-muted/50 border-b border-border/60">
                            <TableCell className="py-3 text-sm font-mono text-muted-foreground truncate">
                              {e.accountNumber || "N/A"}
                            </TableCell>
                            <TableCell className="py-3 text-sm font-semibold text-foreground whitespace-normal break-words">
                              {e.accountTitle}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-muted-foreground">
                              <span className="block whitespace-normal break-words">{group.description}</span>
                              {i === 0 && (
                                <span className="mt-0.5 block whitespace-normal break-words text-xs italic text-muted-foreground/80">
                                  - {e.accountTitle} distribution
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-sm font-semibold tabular-nums text-right whitespace-nowrap">
                              {formatJournalAmount(e.debit)}
                            </TableCell>
                            <TableCell className="py-3 text-sm font-semibold tabular-nums text-right whitespace-nowrap">
                              {formatJournalAmount(e.credit)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}

                      {!isLoading && (
                        <TableRow className="bg-blue-50/30 hover:bg-blue-50/30 dark:bg-blue-950/10 dark:hover:bg-blue-950/10">
                          <TableCell colSpan={3} className="py-2.5 text-sm font-semibold text-foreground">Original journal subtotal</TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap">{formatJournalAmount(group.totalDebit)}</TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap">{formatJournalAmount(group.totalCredit)}</TableCell>
                        </TableRow>
                      )}

                      <TableRow className="bg-amber-50/60 hover:bg-amber-50/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/20">
                        <TableCell colSpan={5} className="py-2 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          Posted Adjustments
                        </TableCell>
                      </TableRow>
                      {isLoadingAjes && (
                        <TableRow className="border-b border-border/60">
                          <TableCell colSpan={5} className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Skeleton className="h-4 w-4 rounded" />
                              <Skeleton className="h-4 w-40" />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoadingAjes && linkedAjes.map((aje) => (
                        <React.Fragment key={aje.id}>
                          <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border/40">
                            <TableCell colSpan={5} className="py-1.5 px-4">
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                ── {aje.jeNo} ({aje.status})
                              </span>
                              {aje.transactionDate && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {format(new Date(aje.transactionDate), "yyyy-MM-dd")}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                          {aje.details.map((detail, di) => (
                            <TableRow key={di} className="hover:bg-muted/50 border-b border-border/60">
                              <TableCell className="py-2.5 text-sm font-mono text-muted-foreground truncate">
                                {detail.accountNumber || "N/A"}
                              </TableCell>
                              <TableCell className="py-2.5 text-sm font-semibold text-foreground whitespace-normal break-words">
                                {detail.accountTitle}
                              </TableCell>
                              <TableCell className="py-2.5 text-sm text-muted-foreground">
                                <span className="block whitespace-normal break-words">{aje.description}</span>
                                {di === 0 && (
                                  <span className="mt-0.5 block whitespace-normal break-words text-xs italic text-muted-foreground/80">
                                    - {detail.accountTitle || "Adjustment"} distribution
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-sm font-semibold tabular-nums text-right whitespace-nowrap">
                                {formatJournalAmount(detail.debit)}
                              </TableCell>
                              <TableCell className="py-2.5 text-sm font-semibold tabular-nums text-right whitespace-nowrap">
                                {formatJournalAmount(detail.credit)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}

                      <TableRow className="bg-amber-50/30 hover:bg-amber-50/30 dark:bg-amber-950/10 dark:hover:bg-amber-950/10">
                        <TableCell colSpan={3} className="py-2.5 text-sm font-semibold text-foreground">Posted adjustments subtotal</TableCell>
                        <TableCell className="py-2.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                          {isLoadingAjes ? <Skeleton className="ml-auto h-4 w-24" /> : formatJournalAmount(ajeTotalDebit)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                          {isLoadingAjes ? <Skeleton className="ml-auto h-4 w-24" /> : formatJournalAmount(ajeTotalCredit)}
                        </TableCell>
                      </TableRow>

                      {/* Combined Total */}
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-2 border-border/80">
                        <TableCell colSpan={3} className="py-3 text-sm font-black text-foreground">Combined total</TableCell>
                        <TableCell className="py-3 text-right font-black text-sm tabular-nums whitespace-nowrap">
                          {isLoading || isLoadingAjes ? (
                            <Skeleton className="h-5 w-24 ml-auto" />
                          ) : (
                            formatJournalAmount(group.totalDebit + ajeTotalDebit)
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right font-black text-sm tabular-nums whitespace-nowrap">
                          {isLoading || isLoadingAjes ? (
                            <Skeleton className="h-5 w-24 ml-auto" />
                          ) : (
                            formatJournalAmount(group.totalCredit + ajeTotalCredit)
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                </Table>
              </div>

              <div className="space-y-4 lg:hidden">
                <section className="overflow-hidden rounded-lg border border-border bg-background">
                  <div className="bg-blue-50/60 px-3 py-2 text-xs font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-950/20 dark:text-blue-200">
                    Original Journal
                  </div>
                  <div className="space-y-2 p-3">
                    {isLoading ? (
                      Array.from({ length: Math.max(3, group.entries.length) }).map((_, index) => (
                        <div key={`mobile-original-skeleton-${index}`} className="space-y-2 rounded-md border border-border p-3">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      ))
                    ) : (
                      group.entries.map((entry, index) => (
                        <JournalLineCard
                          key={`original-${index}`}
                          accountNumber={entry.accountNumber || "N/A"}
                          accountTitle={entry.accountTitle || "N/A"}
                          description={`${group.description}${index === 0 ? ` — ${entry.accountTitle || "Account"} distribution` : ""}`}
                          debit={entry.debit}
                          credit={entry.credit}
                        />
                      ))
                    )}
                    {!isLoading && (
                      <MobileAmountSummary
                        label="Original journal subtotal"
                        debit={group.totalDebit}
                        credit={group.totalCredit}
                      />
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-border bg-background">
                  <div className="bg-amber-50/60 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                    Posted Adjustments
                  </div>
                  <div className="space-y-3 p-3">
                    {isLoadingAjes ? (
                      <div className="flex items-center gap-2 rounded-md border border-border p-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    ) : linkedAjes.length > 0 ? (
                      linkedAjes.map((aje) => (
                        <div key={aje.id} className="space-y-2">
                          <div className="break-words rounded-md bg-muted/30 px-3 py-2 text-xs">
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              {aje.jeNo} ({aje.status})
                            </span>
                            {aje.transactionDate && (
                              <span className="ml-2 text-muted-foreground">
                                {format(new Date(aje.transactionDate), "yyyy-MM-dd")}
                              </span>
                            )}
                          </div>
                          {aje.details.map((detail, index) => (
                            <JournalLineCard
                              key={`${aje.id}-${index}`}
                              accountNumber={detail.accountNumber || "N/A"}
                              accountTitle={detail.accountTitle || "N/A"}
                              description={`${aje.description}${index === 0 ? ` — ${detail.accountTitle || "Adjustment"} distribution` : ""}`}
                              debit={detail.debit}
                              credit={detail.credit}
                            />
                          ))}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        No posted adjustments.
                      </p>
                    )}
                    <MobileAmountSummary
                      label="Posted adjustments subtotal"
                      debit={ajeTotalDebit}
                      credit={ajeTotalCredit}
                      loading={isLoadingAjes}
                    />
                  </div>
                </section>

                <MobileAmountSummary
                  label="Combined total"
                  debit={group.totalDebit + ajeTotalDebit}
                  credit={group.totalCredit + ajeTotalCredit}
                  loading={isLoading || isLoadingAjes}
                  emphasized
                />
              </div>

              {/* Drill-through context and audit trail */}
              <div className="w-full min-w-0 space-y-4">
                
                {/* Drill-through Context */}
                <div className="border border-border rounded-lg p-4 bg-background">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Drill-through Context
                  </h3>
                  {isLoading || !drillThrough ? (
                    <div className="space-y-3">
                      <div>
                        <Skeleton className="h-3 w-20 mb-1.5 rounded-sm" />
                        <Skeleton className="h-4 w-32 rounded-sm" />
                      </div>
                      <div>
                        <Skeleton className="h-3 w-20 mb-1.5 rounded-sm" />
                        <Skeleton className="h-4 w-40 rounded-sm" />
                      </div>
                      <div>
                        <Skeleton className="h-3 w-20 mb-1.5 rounded-sm" />
                        <Skeleton className="h-4 w-40 rounded-sm" />
                      </div>
                      <div>
                        <Skeleton className="h-3 w-20 mb-1.5 rounded-sm" />
                        <Skeleton className="h-4 w-48 rounded-sm" />
                      </div>
                      <div>
                        <Skeleton className="h-3 w-20 mb-1.5 rounded-sm" />
                        <Skeleton className="h-4 w-12 rounded-sm" />
                      </div>
                    </div>
                  ) : (
                    <dl className="space-y-2.5 text-xs">
                      <ContextRow label="Source Module:" value={drillThrough.sourceModule || "N/A"} />
                      <ContextRow label="Source Report:" value={drillThrough.sourceReport || "N/A"} />
                      <ContextRow label="Source Line:" value={drillThrough.sourceLine || "N/A"} bold />
                      <ContextRow label="Source Reference:" value={drillThrough.referenceLink || "N/A"} />
                      <ContextRow label="Posted Only View:" value={drillThrough.postedOnlyView || "N/A"} />
                    </dl>
                  )}
                </div>

                {/* Audit Trail */}
                <div className="border border-border rounded-lg p-4 bg-background">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Audit Trail
                  </h3>
                  <div className="space-y-0">
                    {auditTrail.length > 0 ? (
                      auditTrail.map((audit, idx) => (
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
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-muted bg-muted/20 px-4 py-6 text-center">
                        <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                        <p className="text-xs font-semibold text-foreground">Audit history unavailable</p>
                        <p className="mt-1 text-xs text-muted-foreground">Audit events are not connected to this view.</p>
                      </div>
                    )}
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

function JournalLineCard({
  accountNumber,
  accountTitle,
  description,
  debit,
  credit,
}: {
  accountNumber: string;
  accountTitle: string;
  description: string;
  debit: number;
  credit: number;
}) {
  return (
    <article className="min-w-0 rounded-md border border-border bg-background p-3">
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Account</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">
            <span className="mr-1 font-mono text-muted-foreground">{accountNumber}</span>
            {accountTitle}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Description</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground/80">{description}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Debit</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-foreground">
            {formatJournalAmount(debit)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Credit</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-foreground">
            {formatJournalAmount(credit)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function MobileAmountSummary({
  label,
  debit,
  credit,
  loading = false,
  emphasized = false,
}: {
  label: string;
  debit: number;
  credit: number;
  loading?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className={cn(
      "grid min-w-0 grid-cols-1 gap-3 rounded-md border border-border px-3 py-2.5 sm:grid-cols-2",
      emphasized ? "bg-muted/40" : "bg-muted/20"
    )}>
      <p className="text-sm font-bold text-foreground sm:col-span-2">{label}</p>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Debit</p>
        {loading ? (
          <Skeleton className="mt-1 h-4 w-24" />
        ) : (
          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums text-foreground">{formatJournalAmount(debit)}</p>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Credit</p>
        {loading ? (
          <Skeleton className="mt-1 h-4 w-24" />
        ) : (
          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums text-foreground">{formatJournalAmount(credit)}</p>
        )}
      </div>
    </div>
  );
}

function ParamCard({ label, value, highlight, className, loading }: { 
  label: string; value: string; highlight?: boolean; className?: string; loading?: boolean 
}) {
  return (
    <div className={cn(
      "max-w-full min-w-0 border border-border rounded-lg px-3 py-2 bg-background",
      className
    )}>
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      {loading ? (
        <Skeleton className="h-5 w-[80%] mt-0.5 rounded-sm" />
      ) : (
        <div className={cn(
          "mt-0.5 break-words text-sm",
          highlight ? "font-bold text-foreground" : "font-medium text-foreground/80"
        )}>{value}</div>
      )}
    </div>
  );
}

function StatusParamCard({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
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
        {loading ? (
          <Skeleton className="h-5 w-16 mt-0.5 rounded-sm" />
        ) : (
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border", statusClasses)}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function ContextRow({ label, value, bold }: {
  label: string; value: string; bold?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground font-medium text-xs">{label}</dt>
      <dd className={cn(
        "mt-0.5 break-words text-xs",
        bold ? "font-bold text-foreground" : "font-medium text-foreground/80"
      )}>
        {value}
      </dd>
    </div>
  );
}
