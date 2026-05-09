// src/modules/financial-management/treasury/salesmen-expense-approval/components/ExpenseApprovalModal.tsx
"use client";

import * as React from "react";
import {
  Loader2, ExternalLink, ShieldCheck, X, Check,
  MessageSquareWarning, Receipt, User, Building2, Wallet, Info,
  CheckCircle2, Send
} from "lucide-react";
import { toast } from "sonner";
import { startOfWeek, format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SalesmanExpenseDetail, ExpenseDraftRow, ItemDecision } from "../type";
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

export default function ExpenseApprovalModal({ open, loading, detail, onClose, onConfirmed }: Props) {
  const [itemDecisions, setItemDecisions] = React.useState<Record<number, ItemDecision["status"] | "PENDING">>({});
  const [itemRemarks, setItemRemarks] = React.useState<Record<number, string>>({});
  const [remarks, setRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [localAmounts, setLocalAmounts] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Grouping logic (Particulars/COA + Week)
  const groupedExpenses = React.useMemo(() => {
    if (!detail) return [];

    const groups: Record<string, {
      particulars_name: string;
      particulars: number;
      weeks: Record<string, {
        weekStart: Date;
        items: ExpenseDraftRow[];
      }>;
    }> = {};

    detail.expenses.forEach(exp => {
      const pName = exp.particulars_name || "Uncategorized";
      if (!groups[pName]) {
        groups[pName] = {
          particulars_name: pName,
          particulars: exp.particulars,
          weeks: {}
        };
      }

      const wStart = startOfWeek(new Date(exp.transaction_date + "T00:00:00"), { weekStartsOn: 1 }); // Monday
      const wKey = format(wStart, "yyyy-MM-dd");

      if (!groups[pName].weeks[wKey]) {
        groups[pName].weeks[wKey] = {
          weekStart: wStart,
          items: []
        };
      }
      groups[pName].weeks[wKey].items.push(exp);
    });

    return Object.values(groups)
      .sort((a, b) => a.particulars_name.localeCompare(b.particulars_name))
      .map(group => ({
        ...group,
        weeks: Object.values(group.weeks)
          .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
          .map(week => ({
            ...week,
            items: week.items.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
          }))
      }));
  }, [detail]);

  const activeGroup = React.useMemo(() => {
    if (!selectedGroupId) return null;
    for (const g of groupedExpenses) {
      for (const w of g.weeks) {
        const gid = `${g.particulars}-${format(w.weekStart, "yyyy-MM-dd")}`;
        if (gid === selectedGroupId) return { ...w, particulars_name: g.particulars_name };
      }
    }
    return null;
  }, [selectedGroupId, groupedExpenses]);

  React.useEffect(() => {
    if (open && detail) {
      setRemarks("");
      const initialAmounts: Record<number, string> = {};
      const initialDecisions: Record<number, ItemDecision["status"] | "PENDING"> = {};
      const initialRemarks: Record<number, string> = {};

      detail.expenses.forEach(e => {
        initialAmounts[e.id] = String(e.amount);
        initialDecisions[e.id] = e.status === "With Concern" ? "With Concern" : "PENDING";
        initialRemarks[e.id] = e.feedback || "";
      });

      setLocalAmounts(initialAmounts);
      setItemDecisions(initialDecisions);
      setItemRemarks(initialRemarks);

      if (groupedExpenses.length > 0 && groupedExpenses[0].weeks.length > 0) {
        const first = groupedExpenses[0];
        setSelectedGroupId(`${first.particulars}-${format(first.weeks[0].weekStart, "yyyy-MM-dd")}`);
      }
    }
  }, [open, detail, groupedExpenses]);

  const setItemStatus = (id: number, status: ItemDecision["status"] | "PENDING") => {
    setItemDecisions(prev => ({ ...prev, [id]: prev[id] === status ? "PENDING" : status }));
  };

  const toggleGroupStatus = (groupItems: ExpenseDraftRow[], status: ItemDecision["status"] | "PENDING") => {
    setItemDecisions(prev => {
      const next = { ...prev };
      groupItems.forEach(item => { next[item.id] = status; });
      return next;
    });
  };

  const approveAll = () => {
    const next = { ...itemDecisions };
    detail?.expenses.forEach(item => { next[item.id] = "Approved"; });
    setItemDecisions(next);
  };

  const uncheckAll = () => {
    const next = { ...itemDecisions };
    detail?.expenses.forEach(item => { next[item.id] = "PENDING"; });
    setItemDecisions(next);
  };

  const approvedCount = React.useMemo(() => {
    return Object.values(itemDecisions).filter(s => s === "Approved").length;
  }, [itemDecisions]);

  const totalSelected = React.useMemo(() => {
    if (!detail) return 0;
    return detail.expenses.reduce((acc, p) => {
      if (itemDecisions[p.id] !== "Approved") return acc;
      const val = localAmounts[p.id];
      return acc + (val !== undefined && val !== "" ? Number(val) : Number(p.amount));
    }, 0);
  }, [detail, localAmounts, itemDecisions]);

  const hasPendingItems = React.useMemo(() => {
    return Object.values(itemDecisions).some(s => s === "PENDING");
  }, [itemDecisions]);

  const hasMissingFeedback = React.useMemo(() => {
    if (!detail) return false;
    return detail.expenses.some(p => 
      (itemDecisions[p.id] === "Rejected" || itemDecisions[p.id] === "With Concern") && 
      !(itemRemarks[p.id]?.trim())
    );
  }, [detail, itemDecisions, itemRemarks]);

  const [processingItem, setProcessingItem] = React.useState<number | null>(null);

  const handleSingleItemSubmit = async (p: ExpenseDraftRow) => {
    if (!detail) return;
    const status = itemDecisions[p.id];
    const feedback = itemRemarks[p.id];

    if (status === "PENDING" || !status) return;
    if (!feedback?.trim()) return toast.warning("Feedback is required for this decision.");

    setProcessingItem(p.id);
    try {
      const payloadDecisions: Record<number, ItemDecision> = {
        [p.id]: { status: status as ItemDecision["status"], remarks: feedback.trim() }
      };

      await api.submitBatchApproval({
        salesman_id: detail.salesman.id,
        remarks: `Individual decision for item #${p.id}: ${status}`,
        item_decisions: payloadDecisions,
      });

      toast.success(`Decision for item #${p.id} submitted.`);
      
      // Update local state to remove the item from view
      // Update local state to remove the item from view
      onConfirmed(); 
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit decision.");
    } finally {
      setProcessingItem(null);
    }
  };

  const handleConfirm = async () => {
    if (!detail) return;
    if (!remarks.trim()) return toast.warning("Submission remarks are required.");

    const missingFeedback = detail.expenses
      .filter(p => (itemDecisions[p.id] === "Rejected" || itemDecisions[p.id] === "With Concern"))
      .filter(p => !(itemRemarks[p.id]?.trim()));

    if (missingFeedback.length > 0) {
      return toast.error(`Please provide feedback for the ${missingFeedback.length} items marked as Rejected or With Concern.`);
    }

    setSubmitting(true);
    try {
      const payloadDecisions: Record<number, ItemDecision> = {};
      const payloadEdited: { id: number; amount: number }[] = [];

      detail.expenses.forEach(exp => {
        const status = itemDecisions[exp.id];
        if (status === "PENDING") return;

        payloadDecisions[exp.id] = {
          status: status as ItemDecision["status"],
          remarks: itemRemarks[exp.id] || (status === "Approved" ? "Approved." : "Feedback provided.")
        };

        const currentAmt = Number(localAmounts[exp.id]);
        if (status === "Approved" && currentAmt !== Number(exp.amount)) {
          payloadEdited.push({ id: exp.id, amount: currentAmt });
        }
      });

      await api.submitBatchApproval({
        salesman_id: detail.salesman.id,
        remarks: remarks.trim(),
        item_decisions: payloadDecisions,
        edited_amounts: payloadEdited.length > 0 ? payloadEdited : undefined
      });

      toast.success("Approvals submitted successfully.");
      onConfirmed();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit approvals.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:!max-w-[95vw] sm:!w-[95vw] h-[95vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Salesman Expense Verification</DialogTitle>
        <DialogDescription className="sr-only">Batch review and disbursement processing</DialogDescription>

        {/* Header Section (Blue Pattern) */}
        <div className="px-[2vw] py-[2.5vh] bg-[#1a4f95] text-white shrink-0 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <ShieldCheck size={26} />
                </div>
                Salesman Expense Verification & Approval
              </h2>
              <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em]">
                Review salesman submittals and convert approved items into treasury disbursements.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl">
                Treasury Audit Phase
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Bar Section */}
        <div className="grid grid-cols-4 gap-6 px-[2vw] py-[2vh] bg-white border-b shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-inner">
              <User size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Salesman</p>
              <p className="font-black text-sm text-foreground">{detail?.salesman.salesman_name || "Loading..."}</p>
              <p className="text-[10px] text-muted-foreground font-mono">ID: {detail?.salesman.salesman_code || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Position & Department</p>
              <p className="font-black text-sm text-foreground">{detail?.salesman.user?.user_position || "Field Representative"}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{detail?.salesman.department_name || "Sales & Distribution"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Budget Ceiling</p>
              <p className="font-black text-sm text-emerald-700">{formatCurrency(detail?.expense_limit || 0)}</p>
              <p className="text-[10px] text-muted-foreground italic">Applied to current submittal</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="flex flex-col gap-1 w-full">
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1 text-right">Pending Submittal</p>
              <div className="flex justify-end gap-2">
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black">{detail?.expenses.length || 0} Items</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black">{formatCurrency(detail?.expenses.reduce((s, e) => s + Number(e.amount), 0) || 0)}</Badge>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground">Syncing Details...</span>
          </div>
        ) : (
          <>
            {/* Toolbar Section */}
            <div className="px-[2vw] py-4 bg-muted/5 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-800">
                  <Receipt className="h-4 w-4 text-primary" />
                  Line-Item Expense Breakdown
                </h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={approveAll}>
                    <div className="h-4 w-4 rounded border-2 border-primary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Approve All</span>
                  </div>
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={uncheckAll}>
                    <div className="h-4 w-4 rounded border-2 border-slate-300 flex items-center justify-center group-hover:border-primary transition-colors">
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Uncheck All</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Verified</span>
                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" /> Draft</span>
              </div>
            </div>

            <div className="flex-1 flex min-h-0 bg-slate-50/50">
              {/* Sidebar: Grouped Categories */}
              <div className="w-[25vw] border-r bg-white overflow-y-auto shadow-[5px_0_15px_rgba(0,0,0,0.02)]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-8">Particulars / Review Week</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right pr-4">Amount</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedExpenses.map(g => g.weeks.map(w => {
                      const gid = `${g.particulars}-${format(w.weekStart, "yyyy-MM-dd")}`;
                      const isSelected = selectedGroupId === gid;
                      const total = w.items.reduce((acc, p) => acc + Number(localAmounts[p.id] || 0), 0);
                      const isVerified = w.items.every(i => itemDecisions[i.id] !== "PENDING");
                      return (
                        <TableRow key={gid}
                          className={`cursor-pointer group transition-all ${isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"}`}
                          onClick={() => setSelectedGroupId(gid)}
                        >
                          <TableCell className="pl-8 py-4 relative">
                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 shadow-[2px_0_5px_rgba(37,99,235,0.3)]" />}
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm transition-all ${isSelected ? "bg-blue-600 text-white scale-110 shadow-blue-200" : "bg-slate-100 text-slate-500"}`}>
                                #
                              </div>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-tight text-slate-800 leading-none mb-1 line-clamp-1">{g.particulars_name}</p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{format(w.weekStart, "MMM d")} - Week</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4 pr-4">
                            <p className="text-xs font-black tabular-nums text-slate-800">{formatCurrency(total)}</p>
                            <p className="text-[9px] text-muted-foreground font-bold italic">{w.items.length} items</p>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg shadow-sm transition-all ${isVerified ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 hover:bg-blue-50"}`}
                              onClick={(e) => { e.stopPropagation(); toggleGroupStatus(w.items, "Approved"); }}
                            >
                              {isVerified ? <CheckCircle2 size={16} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }))}
                  </TableBody>
                </Table>
              </div>

              {/* Detail Table Area */}
              <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-8 pt-0">
                  <Table className="border rounded-2xl overflow-hidden shadow-sm">
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm border-b">
                      <TableRow>
                        <TableHead className="w-12 text-center text-[10px] font-black">#</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Encoded Particulars & Remarks</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">Verify Amount</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-16">Docs</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-28">Date</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-40">Status Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeGroup?.items.map((p, idx) => {
                        const status = itemDecisions[p.id] || "PENDING";
                        const isReadOnly = p.status === "Rejected" || p.status === "With Concern";
                        return (
                          <React.Fragment key={p.id}>
                            <TableRow className={`group hover:bg-slate-50/50 border-b border-slate-100 transition-all ${status === "Approved" ? "bg-emerald-50/20" : status === "Rejected" ? "bg-rose-50/20" : status === "With Concern" ? "bg-amber-50/20" : ""}`}>
                                  <TableCell className="text-center py-4 text-[10px] font-black text-slate-300 italic">{(idx + 1).toString().padStart(2, '0')}</TableCell>
                                  <TableCell className="py-4">
                                    <p className="text-xs font-black text-slate-800 leading-none mb-1">{p.remarks || "No remarks provided"}</p>
                                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Batch: {p.header_id}</p>
                                  </TableCell>
                                  <TableCell className="py-4 text-center">
                                    <Input
                                      className={`h-8 w-28 text-center text-xs font-black tabular-nums transition-all ${Number(localAmounts[p.id]) !== Number(p.amount) ? "bg-amber-50 border-amber-300 text-amber-700 shadow-inner" : "bg-slate-50 border-slate-200"}`}
                                      value={localAmounts[p.id] || ""}
                                      disabled={processingItem === p.id || submitting || isReadOnly}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (/^\d*\.?\d*$/.test(val)) setLocalAmounts(prev => ({ ...prev, [p.id]: val }));
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="py-4 text-center">
                                    {p.attachment_url && (
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" 
                                        onClick={() => setPreviewUrl(`/api/fm/expense-assets?id=${p.attachment_url}`)}
                                        disabled={processingItem === p.id || submitting || isReadOnly}
                                      >
                                        <ExternalLink size={14} />
                                      </Button>
                                    )}
                                  </TableCell>
                              <TableCell className="py-4 text-center text-[10px] font-bold text-slate-500 uppercase">{formatDate(p.transaction_date)}</TableCell>
                              <TableCell className="py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="icon" 
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${status === "Approved" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 hover:bg-emerald-50"}`} 
                                          onClick={() => setItemStatus(p.id, "Approved")} 
                                          disabled={processingItem === p.id || submitting || isReadOnly}
                                        >
                                          <Check size={16} strokeWidth={3} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">Approve Item</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="icon" 
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${status === "With Concern" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400 hover:bg-amber-50"}`} 
                                          onClick={() => setItemStatus(p.id, "With Concern")} 
                                          disabled={processingItem === p.id || submitting || isReadOnly}
                                        >
                                          <MessageSquareWarning size={14} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">Raise Concern</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="icon" 
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${status === "Rejected" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400 hover:bg-rose-50"}`} 
                                          onClick={() => setItemStatus(p.id, "Rejected")} 
                                          disabled={processingItem === p.id || submitting || isReadOnly}
                                        >
                                          <X size={16} strokeWidth={3} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">Hard Reject</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                            {(status === "Rejected" || status === "With Concern") && (
                              <TableRow className={`${status === "Rejected" ? "bg-rose-50/30" : "bg-amber-50/30"}`}>
                                <TableCell colSpan={6} className="px-8 py-3">
                                  <div className="flex items-center gap-4 pl-12 flex-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${status === "Rejected" ? "text-rose-600" : "text-amber-600"} shrink-0`}>Audit Feedback:</span>
                                    <Input
                                      placeholder="Provide mandatory reason for rejection/concern..."
                                      className="h-8 text-xs font-medium border-2 focus:border-primary bg-white shadow-inner flex-1"
                                      value={itemRemarks[p.id] || ""}
                                      onChange={(e) => setItemRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                                      disabled={processingItem === p.id || submitting || isReadOnly}
                                    />
                                    <Button 
                                      size="sm" 
                                      className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-md gap-2"
                                      disabled={processingItem === p.id || !itemRemarks[p.id]?.trim() || isReadOnly}
                                      onClick={() => handleSingleItemSubmit(p)}
                                    >
                                      {processingItem === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                      Submit Decision
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Summary Section */}
                <div className="p-8 border-t bg-slate-50 flex items-end justify-between gap-12 relative shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                  <div className="flex-1 space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                      <Info size={14} className="text-blue-500" />
                      Disbursement Header Remarks <span className="text-red-500 font-black">*</span>
                    </label>
                    <Textarea
                      rows={4}
                      className="bg-white border-slate-200 rounded-2xl p-4 text-sm font-medium shadow-inner resize-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder={approvedCount === 0 ? "Approve at least one item to provide batch remarks..." : "Explain the reason for this batch disbursement submittal..."}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      disabled={approvedCount === 0 || submitting}
                    />
                    <p className="text-[9px] font-bold text-slate-400 italic">
                      All <span className="text-emerald-600 font-black uppercase underline decoration-2">Approved</span> items will be consolidated into a single disbursement draft.
                    </p>
                  </div>

                  <div className="w-80 flex flex-col gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Consolidation Summary</span>
                        <span className="text-blue-600">{approvedCount} Lines Verified</span>
                      </div>
                      <div className="h-[1px] bg-slate-100 w-full" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Total:</span>
                        <span className="text-2xl font-black tabular-nums text-blue-700 tracking-tighter">{formatCurrency(totalSelected)}</span>
                      </div>
                      <Button
                        disabled={submitting || hasPendingItems || hasMissingFeedback || !remarks.trim() || approvedCount === 0}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 gap-3 active:scale-[0.98] transition-all"
                        onClick={handleConfirm}
                      >
                        {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                        Finalize Batch
                      </Button>
                    </div>
                    <button className="w-full py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors" onClick={onClose}>
                      Discard Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>

      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] p-0 overflow-hidden bg-black border-none shadow-2xl flex items-center justify-center">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setPreviewUrl(null)}>
            <X size={24} />
          </Button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className="max-w-[90vw] max-h-[85vh] object-contain mx-auto" />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
