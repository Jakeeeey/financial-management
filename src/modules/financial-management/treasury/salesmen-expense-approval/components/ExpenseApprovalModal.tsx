// src/modules/financial-management/treasury/salesmen-expense-approval/components/ExpenseApprovalModal.tsx
"use client";

import * as React from "react";
import { Loader2, ExternalLink, CheckSquare, Square, AlertCircle, FileText, User, Briefcase, Hash, Wallet, Info, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { SalesmanExpenseDetail, ExpenseDraftRow } from "../type";
import * as api from "../providers/fetchProvider";

interface Props {
  open: boolean;
  loading: boolean;
  detail: SalesmanExpenseDetail | null;
  onClose: () => void;
  onConfirmed: () => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return d;
  }
}

function statusBadge(status: ExpenseDraftRow["status"]) {
  if (status === "Drafts")
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 shadow-sm transition-all hover:scale-105">Draft</Badge>;
  if (status === "Rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200 shadow-sm transition-all hover:scale-105">Rejected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function ExpenseApprovalModal({ open, loading, detail, onClose, onConfirmed }: Props) {
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [remarks, setRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Reset selections when detail changes (new salesman loaded)
  React.useEffect(() => {
    setSelectedIds(new Set());
    setRemarks("");
  }, [detail]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!detail) return;
    const allIds = detail.expenses.map((e) => e.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  const totalSelected = detail?.expenses
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const expenseLimit = detail?.expense_limit ?? 0;
  const allIds = detail?.expenses.map((e) => e.id) ?? [];
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;

  // Check if the total of selected items exceeds the batch limit
  const isOverBatchLimit = expenseLimit > 0 && totalSelected > expenseLimit;

  function rowBgClass(expense: ExpenseDraftRow): string {
    if (!selectedIds.has(expense.id)) return "opacity-50 grayscale-[0.5]";
    if (isOverBatchLimit) {
      return "bg-red-100/80 dark:bg-red-900/40 border-l-4 border-l-red-600 font-medium";
    }
    return "bg-green-50/80 dark:bg-green-900/20 border-l-4 border-l-green-500";
  }

  async function handleConfirm() {
    if (!detail) return;
    if (selectedIds.size === 0) {
      toast.warning("Please select at least one expense to approve.");
      return;
    }
    if (!remarks.trim()) {
      toast.warning("Remarks are required for the disbursement record.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.confirmExpenses({
        selected_ids: [...selectedIds],
        all_ids: allIds,
        remarks: remarks.trim(),
        salesman_user_id: detail.salesman.employee_id,
        salesman_id: detail.salesman.id,
        device_time: new Date().toLocaleString("sv-SE").replace(" ", "T"),
      });

      if (result.doc_no) {
        toast.success(`Transaction confirmed! Doc No: ${result.doc_no}`, {
          description: `Disbursement draft ${result.doc_no} has been created.`
        });
      } else {
        toast.info("Process complete. No expenses were approved.");
      }
      onConfirmed();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Process failed");
    } finally {
      setSubmitting(false);
    }
  }

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const salesman = detail?.salesman;
  const userName = salesman?.user
    ? [salesman.user.user_fname, salesman.user.user_mname, salesman.user.user_lname]
        .filter(Boolean).join(" ")
    : salesman?.salesman_name ?? "—";

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-4 bg-primary text-primary-foreground shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <FileText size={120} />
            </div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Expense Approval & Disbursement Generation
            </DialogTitle>
            <p className="text-primary-foreground/80 text-sm">
              Review salesmen submittals and convert approved items into treasury disbursements.
            </p>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="font-medium">Retrieving encoded records...</span>
            </div>
          ) : !detail ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
              <AlertCircle size={48} className="opacity-20" />
              <p>Salesman details could not be loaded.</p>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-muted/20">
              {/* Extended Salesman Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4 bg-background border-b items-start">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <User size={10} /> Salesman
                  </p>
                  <p className="font-bold text-sm leading-tight">{userName}</p>
                  <p className="text-[10px] text-muted-foreground truncate italic font-mono uppercase tracking-tight">
                    ID: {salesman?.salesman_code ?? "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Briefcase size={10} /> Position & Department
                  </p>
                  <p className="font-semibold text-sm leading-tight text-foreground/80 truncate">
                    {salesman?.user?.user_position ?? "N/A"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {salesman?.department_name || "N/A"} / {salesman?.division_name || "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Wallet size={10} /> Budget Ceiling
                  </p>
                  <p className={`font-black text-sm leading-tight ${expenseLimit > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {expenseLimit > 0 ? formatCurrency(expenseLimit) : "Unlimited"}
                  </p>
                  <p className="text-[10px] text-muted-foreground italic tracking-tight leading-none pt-1">Applied to total selection</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Hash size={10} /> Pending Items
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                      {detail.expenses.filter(e => e.status === "Drafts").length} Draft
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-red-50 text-red-700 border-red-200">
                      {detail.expenses.filter(e => e.status === "Rejected").length} Rejected
                    </Badge>
                  </div>
                </div>
              </div>

              {isOverBatchLimit && (
                <div className="px-6 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-red-600 animate-bounce" />
                  <p className="text-xs font-bold text-red-700 uppercase tracking-tight">
                    Warning: The total selected amount exceeds this user&apos;s expense ceiling for this batch.
                  </p>
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 gap-4">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Encoded Expense Drafts
                  </h3>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm" /> NORMAL
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-red-600 shadow-sm animate-pulse" /> OVER LIMIT
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto rounded-xl border bg-background shadow-inner">
                  <Table className="relative">
                    <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="w-10 text-center">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={toggleAll}
                                  className="cursor-pointer flex items-center justify-center p-1 rounded-md hover:bg-muted transition-all"
                                >
                                  {allSelected
                                    ? <CheckSquare className="h-5 w-5 text-primary" />
                                    : <Square className="h-5 w-5 text-muted-foreground" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Select All Items</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-tighter italic">#</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-tight">Particulars / COA</TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase tracking-tight">Amount</TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Docs</TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Date</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-tight">Encoded Remarks</TableHead>
                        <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.expenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-20">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Briefcase size={40} className="opacity-10" />
                              <p className="font-medium">No pending expenses found for this period.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.expenses.map((expense, idx) => (
                          <TableRow
                            key={expense.id}
                            className={`group cursor-pointer transition-all border-b-muted/40 ${rowBgClass(expense)} hover:opacity-100`}
                            onClick={() => toggle(expense.id)}
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(expense.id)}
                                onCheckedChange={() => toggle(expense.id)}
                                className="w-5 h-5 shadow-sm border-2 border-muted-foreground/30 data-[state=checked]:bg-primary"
                              />
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-mono text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm font-bold leading-tight truncate">
                                {expense.particulars_name || "Uncategorized Particular"}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                #{expense.particulars}
                              </p>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <p className={`text-sm font-black tabular-nums ${expenseLimit > 0 && Number(expense.amount) > expenseLimit ? 'text-red-700 animate-pulse font-extrabold' : 'text-foreground'}`}>
                                {formatCurrency(Number(expense.amount))}
                              </p>
                            </TableCell>
                            <TableCell className="text-center">
                              {expense.attachment_url ? (
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewUrl(`/api/assets?id=${expense.attachment_url}`);
                                        }}
                                        className="inline-flex p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm cursor-pointer"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Preview Attachment</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="opacity-20">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-xs whitespace-nowrap font-medium text-muted-foreground">
                              {formatDate(expense.transaction_date)}
                            </TableCell>
                            <TableCell className="text-xs max-w-[240px] italic text-muted-foreground group-hover:text-foreground line-clamp-2 leading-snug">
                              {expense.remarks || "No encoded remarks."}
                            </TableCell>
                            <TableCell className="text-center">{statusBadge(expense.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Footer / Submission Area */}
              <div className="px-6 py-5 bg-background shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] shrink-0 border-t flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-end gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        Disbursement Remarks <span className="text-red-600 font-bold">*</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info size={12} className="text-muted-foreground/50" />
                            </TooltipTrigger>
                            <TooltipContent side="right">This will be printed on the official disbursement form.</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                    </div>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Provide a justification for this batch of expenses..."
                      className="min-h-[90px] max-h-[90px] resize-none border-2 focus:border-primary transition-all shadow-sm font-medium"
                      disabled={submitting}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Unselected expenses will be automatically tagged as <span className="text-red-600 font-bold uppercase italic">Rejected</span>.
                    </p>
                  </div>

                  <div className="w-full md:w-[320px] bg-muted/40 rounded-xl p-4 border border-muted/60 flex flex-col gap-3 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-muted pb-2">
                      <span>Summary</span>
                      <span className="text-foreground tracking-tighter">{selectedIds.size} Lines Selected</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-muted-foreground italic tracking-tighter uppercase line-clamp-1">Grand Total:</span>
                      <span className="text-2xl font-black tabular-nums tracking-tighter text-primary drop-shadow-sm">
                        {formatCurrency(totalSelected || 0)}
                      </span>
                    </div>
                    <Button
                      className="w-full h-12 rounded-lg font-bold shadow-lg hover:shadow-primary/20 active:scale-95 transition-all text-sm uppercase tracking-widest bg-primary hover:bg-primary/90"
                      onClick={handleConfirm}
                      disabled={submitting || detail.expenses.length === 0}
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <CheckSquare className="mr-2 h-5 w-5" />
                      )}
                      Generate Disbursement
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto py-0 text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-red-600 transition-colors"
                      onClick={onClose}
                      disabled={submitting}
                    >
                      Discard and Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[90vw] max-h-[85vh] w-fit p-0 overflow-hidden bg-black border-none shadow-2xl flex flex-col items-center justify-center rounded-lg"
        >
          <DialogTitle className="sr-only">Expense Attachment Preview</DialogTitle>
          <Button
            variant="default"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl opacity-100 transition-all active:scale-90 border-none h-10 w-10 flex items-center justify-center z-50"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-6 w-6 stroke-[2.5]" />
          </Button>
          <div className="relative group flex items-center justify-center">
            {previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Expense Attachment"
                className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain shadow-2xl transition-all duration-300"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


