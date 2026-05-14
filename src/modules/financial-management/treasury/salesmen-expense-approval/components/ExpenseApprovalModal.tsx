// src/modules/financial-management/treasury/salesmen-expense-approval/components/ExpenseApprovalModal.tsx
"use client";

import * as React from "react";
import {
  Loader2,
  ExternalLink,
  ShieldCheck,
  X,
  Check,
  MessageSquareWarning,
  Receipt,
  User,
  Building2,
  Wallet,
  CheckCircle2,
  Send,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

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

import type {
  SalesmanExpenseDetail,
  ExpenseDraftRow,
  ItemDecision,
  ExpenseHeader,
} from "../type";
import * as api from "../providers/fetchProvider";

interface Props {
  open: boolean;
  loading: boolean;
  detail: SalesmanExpenseDetail | null;
  selectedHeader: ExpenseHeader | null;
  onClose: () => void;
  onConfirmed: () => void;
}

type UiDecisionStatus = ItemDecision["status"] | "PENDING";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return "—";

  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

function isDraftExpense(expense: ExpenseDraftRow) {
  return normalizeStatus(expense.status) === "drafts";
}

function needsFeedback(status: UiDecisionStatus) {
  return status === "Rejected" || status === "With Concern";
}

function getStatusBadgeClass(status: UiDecisionStatus) {
  if (status === "Approved") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Rejected") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "With Concern") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function ExpenseApprovalModal({
  open,
  loading,
  detail,
  selectedHeader,
  onClose,
  onConfirmed,
}: Props) {
  const [itemDecisions, setItemDecisions] = React.useState<Record<number, UiDecisionStatus>>({});
  const [itemRemarks, setItemRemarks] = React.useState<Record<number, string>>({});
  const [remarks, setRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [localAmounts, setLocalAmounts] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [processingItem, setProcessingItem] = React.useState<number | null>(null);

  const headerExpenses = React.useMemo(() => {
    if (!detail || !selectedHeader) return [];
    return detail.expenses.filter((expense) => Number(expense.header_id) === selectedHeader.id);
  }, [detail, selectedHeader]);

  const editableHeaderExpenses = React.useMemo(() => {
    return headerExpenses.filter(isDraftExpense);
  }, [headerExpenses]);

  const hasEditableHeaderExpenses = editableHeaderExpenses.length > 0;
  const viewOnlyHeaderExpensesCount = headerExpenses.length - editableHeaderExpenses.length;

  const groupedExpenses = React.useMemo(() => {
    const groups: Record<
      string,
      { particulars_name: string; particulars: number; items: ExpenseDraftRow[] }
    > = {};

    headerExpenses.forEach((expense) => {
      const key = String(expense.particulars);

      if (!groups[key]) {
        groups[key] = {
          particulars_name: expense.particulars_name || "Uncategorized",
          particulars: expense.particulars,
          items: [],
        };
      }

      groups[key].items.push(expense);
    });

    return Object.values(groups)
      .sort((a, b) => a.particulars_name.localeCompare(b.particulars_name))
      .map((group) => ({
        ...group,
        items: group.items.sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        ),
      }));
  }, [headerExpenses]);

  const activeGroup = React.useMemo(() => {
    if (!selectedGroupId) return null;
    return groupedExpenses.find((group) => String(group.particulars) === selectedGroupId) || null;
  }, [selectedGroupId, groupedExpenses]);

  React.useEffect(() => {
    if (!open || !detail) return;

    setRemarks("");
    setConfirmOpen(false);
    setProcessingItem(null);

    const initialAmounts: Record<number, string> = {};
    const initialDecisions: Record<number, UiDecisionStatus> = {};
    const initialRemarks: Record<number, string> = {};

    detail.expenses.forEach((expense) => {
      initialAmounts[expense.id] = String(expense.amount);
      initialDecisions[expense.id] = isDraftExpense(expense) ? "PENDING" : (expense.status as UiDecisionStatus);
      initialRemarks[expense.id] = expense.feedback || "";
    });

    setLocalAmounts(initialAmounts);
    setItemDecisions(initialDecisions);
    setItemRemarks(initialRemarks);

    if (groupedExpenses.length > 0) {
      setSelectedGroupId(String(groupedExpenses[0].particulars));
    } else {
      setSelectedGroupId(null);
    }
  }, [open, detail, groupedExpenses]);

  const setItemStatus = (expense: ExpenseDraftRow, status: UiDecisionStatus) => {
    if (!isDraftExpense(expense)) {
      toast.info("This expense is already processed and is view-only.");
      return;
    }

    setItemDecisions((prev) => ({
      ...prev,
      [expense.id]: prev[expense.id] === status ? "PENDING" : status,
    }));
  };

  const toggleGroupStatus = (groupItems: ExpenseDraftRow[], status: UiDecisionStatus) => {
    const editableItems = groupItems.filter(isDraftExpense);

    if (editableItems.length === 0) {
      toast.info("This group has no Drafts items to approve.");
      return;
    }

    setItemDecisions((prev) => {
      const next = { ...prev };
      editableItems.forEach((item) => {
        next[item.id] = status;
      });
      return next;
    });
  };

  const approveAll = () => {
    if (!hasEditableHeaderExpenses) {
      toast.info("This submittal is view-only because there are no Drafts items.");
      return;
    }

    setItemDecisions((prev) => {
      const next = { ...prev };
      editableHeaderExpenses.forEach((item) => {
        next[item.id] = "Approved";
      });
      return next;
    });
  };

  const uncheckAll = () => {
    if (!hasEditableHeaderExpenses) {
      toast.info("This submittal is view-only because there are no Drafts items.");
      return;
    }

    setItemDecisions((prev) => {
      const next = { ...prev };
      editableHeaderExpenses.forEach((item) => {
        next[item.id] = "PENDING";
      });
      return next;
    });
  };

  const approvedCount = React.useMemo(() => {
    return editableHeaderExpenses.filter((expense) => itemDecisions[expense.id] === "Approved")
      .length;
  }, [editableHeaderExpenses, itemDecisions]);

  const totalSelected = React.useMemo(() => {
    return editableHeaderExpenses.reduce((acc, expense) => {
      if (itemDecisions[expense.id] !== "Approved") return acc;

      const value = localAmounts[expense.id];
      const amount = value !== undefined && value !== "" ? Number(value) : Number(expense.amount);

      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [editableHeaderExpenses, localAmounts, itemDecisions]);

  const hasPendingItems = React.useMemo(() => {
    return editableHeaderExpenses.some((expense) => itemDecisions[expense.id] === "PENDING");
  }, [editableHeaderExpenses, itemDecisions]);

  const itemsMissingFeedback = React.useMemo(() => {
    return editableHeaderExpenses.filter((expense) => {
      const decision = itemDecisions[expense.id];
      return needsFeedback(decision) && !itemRemarks[expense.id]?.trim();
    });
  }, [editableHeaderExpenses, itemDecisions, itemRemarks]);

  const hasMissingFeedback = itemsMissingFeedback.length > 0;

  const hasAnyEditableDecision = React.useMemo(() => {
    return editableHeaderExpenses.some((expense) => itemDecisions[expense.id] !== "PENDING");
  }, [editableHeaderExpenses, itemDecisions]);

  const handleSingleItemSubmit = async (expense: ExpenseDraftRow) => {
    if (!detail) return;

    if (!isDraftExpense(expense)) {
      toast.info("This expense is already processed and is view-only.");
      return;
    }

    const status = itemDecisions[expense.id];
    const feedback = itemRemarks[expense.id];

    if (status === "PENDING" || !status) return;

    if (needsFeedback(status) && !feedback?.trim()) {
      return toast.warning("Feedback is required for rejected or concern items.");
    }

    setProcessingItem(expense.id);

    try {
      const payloadDecisions: Record<number, ItemDecision> = {
        [expense.id]: {
          status: status as ItemDecision["status"],
          remarks: needsFeedback(status) ? feedback.trim() : "Approved.",
        },
      };

      await api.submitBatchApproval({
        salesman_id: detail.salesman.id,
        remarks: `Individual decision for item #${expense.id}: ${status}`,
        item_decisions: payloadDecisions,
      });

      toast.success(`Decision for item #${expense.id} submitted.`);
      onConfirmed();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit decision.");
    } finally {
      setProcessingItem(null);
    }
  };

  const handleConfirm = async () => {
    if (!detail) return;

    if (!hasEditableHeaderExpenses) {
      return toast.info("This submittal is view-only because there are no Drafts items.");
    }

    if (!hasAnyEditableDecision) {
      return toast.warning(
        "Please make at least one decision for a Drafts item before finalizing."
      );
    }

    if (!remarks.trim()) {
      return toast.warning("Submission remarks are required.");
    }

    if (itemsMissingFeedback.length > 0) {
      return toast.error(
        `Please provide feedback for the ${itemsMissingFeedback.length} rejected/concern item(s).`
      );
    }

    setSubmitting(true);
    setConfirmOpen(false);

    try {
      const payloadDecisions: Record<number, ItemDecision> = {};
      const payloadEdited: { id: number; amount: number }[] = [];

      editableHeaderExpenses.forEach((expense) => {
        const status = itemDecisions[expense.id];
        if (status === "PENDING") return;

        payloadDecisions[expense.id] = {
          status: status as ItemDecision["status"],
          remarks: needsFeedback(status)
            ? itemRemarks[expense.id]?.trim() || "Feedback provided."
            : itemRemarks[expense.id]?.trim() || "Approved.",
        };

        const currentAmount = Number(localAmounts[expense.id]);
        if (
          status === "Approved" &&
          Number.isFinite(currentAmount) &&
          currentAmount !== Number(expense.amount)
        ) {
          payloadEdited.push({ id: expense.id, amount: currentAmount });
        }
      });

      await api.submitBatchApproval({
        salesman_id: detail.salesman.id,
        remarks: remarks.trim(),
        item_decisions: payloadDecisions,
        edited_amounts: payloadEdited.length > 0 ? payloadEdited : undefined,
      });

      toast.success("Approvals submitted successfully.");
      onConfirmed();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit approvals.");
    } finally {
      setSubmitting(false);
    }
  };

  const headerTotalAmount = React.useMemo(() => {
    return headerExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [headerExpenses]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:!max-w-[95vw] sm:!w-[95vw] h-[95vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Salesman Expense Verification</DialogTitle>
        <DialogDescription className="sr-only">
          Batch review and disbursement processing
        </DialogDescription>

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
                Review salesman submittals and convert approved Drafts items into treasury
                disbursements.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <Badge className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl">
                {hasEditableHeaderExpenses ? "Treasury Audit Phase" : "View Only Mode"}
              </Badge>
              {selectedHeader && (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                  <Calendar size={12} className="text-white/60" />
                  {formatDate(selectedHeader.period_from)} — {formatDate(selectedHeader.period_to)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 px-[2vw] py-[2vh] bg-white border-b shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-inner">
              <User size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">
                Salesman
              </p>
              <p className="font-black text-sm text-foreground">
                {detail?.salesman.salesman_name || "Loading..."}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                ID: {detail?.salesman.salesman_code || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">
                Position & Department
              </p>
              <p className="font-black text-sm text-foreground">
                {detail?.salesman.user?.user_position || "Field Representative"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                {detail?.salesman.department_name || "Sales & Distribution"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">
                Budget Ceiling
              </p>
              <p className="font-black text-sm text-emerald-700">
                {formatCurrency(detail?.expense_limit || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground italic">
                Applied to current submittal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pl-6 border-l border-muted/50">
            <div className="flex flex-col gap-1 w-full">
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1 text-right">
                Selected Submittal
              </p>
              <div className="flex justify-end gap-2 flex-wrap">
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black">
                  {headerExpenses.length} Items
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-black">
                  {editableHeaderExpenses.length} Drafts
                </Badge>
                {viewOnlyHeaderExpensesCount > 0 && (
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-black">
                    {viewOnlyHeaderExpensesCount} View Only
                  </Badge>
                )}
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black">
                  {formatCurrency(headerTotalAmount)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Syncing Details...
            </span>
          </div>
        ) : (
          <>
            <div className="px-[2vw] py-4 bg-muted/5 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-800">
                  <Receipt className="h-4 w-4 text-primary" />
                  Line-Item Expense Breakdown
                </h3>

                {hasEditableHeaderExpenses ? (
                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      className="flex items-center gap-2 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={approveAll}
                      disabled={submitting}
                    >
                      <span className="h-4 w-4 rounded border-2 border-primary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Approve All Drafts
                      </span>
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-2 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={uncheckAll}
                      disabled={submitting}
                    >
                      <span className="h-4 w-4 rounded border-2 border-slate-300 flex items-center justify-center group-hover:border-primary transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Uncheck Drafts
                      </span>
                    </button>
                  </div>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-black uppercase tracking-widest">
                    No Drafts items. This modal is view-only.
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                  Approved
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                  Draft Editable
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" />
                  View Only
                </span>
              </div>
            </div>

            <div className="flex-1 flex min-h-0 bg-slate-50/50">
              <div className="w-[25vw] border-r bg-white overflow-y-auto shadow-[5px_0_15px_rgba(0,0,0,0.02)]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-8">
                        Particulars / COA
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right pr-4">
                        Amount
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center w-24">
                        Batch Approve
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedExpenses.map((group) => {
                      const groupId = String(group.particulars);
                      const isSelected = selectedGroupId === groupId;
                      const total = group.items.reduce(
                        (acc, expense) => acc + Number(localAmounts[expense.id] || 0),
                        0
                      );
                      const editableGroupItems = group.items.filter(isDraftExpense);
                      const allEditableApproved =
                        editableGroupItems.length > 0 &&
                        editableGroupItems.every(
                          (item) => itemDecisions[item.id] === "Approved"
                        );
                      const allGroupItemsProcessed = group.items.every(
                        (item) => !isDraftExpense(item)
                      );

                      return (
                        <TableRow
                          key={groupId}
                          className={`cursor-pointer group transition-all ${
                            isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"
                          }`}
                          onClick={() => setSelectedGroupId(groupId)}
                        >
                          <TableCell className="pl-8 py-4 relative">
                            {isSelected && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 shadow-[2px_0_5px_rgba(37,99,235,0.3)]" />
                            )}
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm transition-all ${
                                  isSelected
                                    ? "bg-blue-600 text-white scale-110 shadow-blue-200"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                #
                              </div>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-tight text-slate-800 leading-none mb-1 line-clamp-1">
                                  {group.particulars_name}
                                </p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">
                                  {group.items.length} line item{group.items.length !== 1 ? "s" : ""}
                                  {editableGroupItems.length > 0
                                    ? ` • ${editableGroupItems.length} Drafts`
                                    : " • View only"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4 pr-4">
                            <p className="text-xs font-black tabular-nums text-slate-800">
                              {formatCurrency(total)}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-bold italic">
                              {allGroupItemsProcessed
                                ? "Already processed"
                                : allEditableApproved
                                  ? "Drafts verified"
                                  : "Pending Drafts review"}
                            </p>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Button
                              variant={allEditableApproved ? "default" : "outline"}
                              size="sm"
                              disabled={submitting || editableGroupItems.length === 0}
                              className={`h-7 px-3 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${
                                allEditableApproved
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-md shadow-emerald-200"
                                  : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 border-slate-200"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleGroupStatus(group.items, "Approved");
                              }}
                            >
                              {allEditableApproved ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  <span>Approved</span>
                                </div>
                              ) : editableGroupItems.length === 0 ? (
                                "Locked"
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-8 pt-0">
                  <Table className="border rounded-2xl overflow-hidden shadow-sm">
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm border-b">
                      <TableRow>
                        <TableHead className="w-12 text-center text-[10px] font-black">
                          #
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">
                          Encoded Particulars & Remarks
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">
                          Verify Amount
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-16">
                          Docs
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-28">
                          Date
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4 w-40">
                          Status Decision
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeGroup?.items.map((expense, index) => {
                        const status = itemDecisions[expense.id] || "PENDING";
                        const isReadOnly = !isDraftExpense(expense);
                        const isBusy = processingItem === expense.id || submitting;

                        return (
                          <React.Fragment key={expense.id}>
                            <TableRow
                              className={`group hover:bg-slate-50/50 border-b border-slate-100 transition-all ${
                                isReadOnly ? "opacity-80" : ""
                              } ${
                                status === "Approved"
                                  ? "bg-emerald-50/20"
                                  : status === "Rejected"
                                    ? "bg-rose-50/20"
                                    : status === "With Concern"
                                      ? "bg-amber-50/20"
                                      : ""
                              }`}
                            >
                              <TableCell className="text-center py-4 text-[10px] font-black text-slate-300 italic">
                                {(index + 1).toString().padStart(2, "0")}
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-black text-slate-800 leading-none mb-1">
                                      {expense.remarks || "No remarks provided"}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground font-mono uppercase">
                                      Batch: {expense.header_id}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] font-black uppercase tracking-widest ${getStatusBadgeClass(
                                      status
                                    )}`}
                                  >
                                    {isReadOnly ? expense.status : status === "PENDING" ? "Drafts" : status}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-center">
                                <Input
                                  className={`h-8 w-28 text-center text-xs font-black tabular-nums transition-all ${
                                    isReadOnly
                                      ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                      : Number(localAmounts[expense.id]) !== Number(expense.amount)
                                        ? "bg-amber-50 border-amber-300 text-amber-700 shadow-inner"
                                        : "bg-slate-50 border-slate-200"
                                  }`}
                                  value={localAmounts[expense.id] || ""}
                                  disabled={isBusy || isReadOnly}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    if (/^\d*\.?\d*$/.test(value)) {
                                      setLocalAmounts((prev) => ({
                                        ...prev,
                                        [expense.id]: value,
                                      }));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="py-4 text-center">
                                {expense.attachment_url && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    onClick={() =>
                                      setPreviewUrl(
                                        `/api/fm/expense-assets?id=${expense.attachment_url}`
                                      )
                                    }
                                    disabled={isBusy}
                                  >
                                    <ExternalLink size={14} />
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="py-4 text-center text-[10px] font-bold text-slate-500 uppercase">
                                {formatDate(expense.transaction_date)}
                              </TableCell>
                              <TableCell className="py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${
                                            status === "Approved"
                                              ? "bg-emerald-500 text-white"
                                              : "bg-slate-100 text-slate-400 hover:bg-emerald-50"
                                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                                          onClick={() => setItemStatus(expense, "Approved")}
                                          disabled={isBusy || isReadOnly}
                                        >
                                          <Check size={16} strokeWidth={3} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">
                                        {isReadOnly ? "View Only" : "Approve Item"}
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${
                                            status === "With Concern"
                                              ? "bg-amber-500 text-white"
                                              : "bg-slate-100 text-slate-400 hover:bg-amber-50"
                                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                                          onClick={() => setItemStatus(expense, "With Concern")}
                                          disabled={isBusy || isReadOnly}
                                        >
                                          <MessageSquareWarning size={14} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">
                                        {isReadOnly ? "View Only" : "Raise Concern"}
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          className={`h-8 w-8 rounded-lg shadow-sm transition-all ${
                                            status === "Rejected"
                                              ? "bg-rose-500 text-white"
                                              : "bg-slate-100 text-slate-400 hover:bg-rose-50"
                                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                                          onClick={() => setItemStatus(expense, "Rejected")}
                                          disabled={isBusy || isReadOnly}
                                        >
                                          <X size={16} strokeWidth={3} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[9px] font-black uppercase">
                                        {isReadOnly ? "View Only" : "Hard Reject"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>

                            {needsFeedback(status) && (
                              <TableRow
                                className={
                                  status === "Rejected" ? "bg-rose-50/30" : "bg-amber-50/30"
                                }
                              >
                                <TableCell colSpan={6} className="px-8 py-3">
                                  <div className="flex items-center gap-4 pl-12 flex-1">
                                    <span
                                      className={`text-[10px] font-black uppercase tracking-widest ${
                                        status === "Rejected" ? "text-rose-600" : "text-amber-600"
                                      } shrink-0`}
                                    >
                                      Audit Feedback:
                                    </span>
                                    <Input
                                      placeholder="Provide mandatory reason for rejection/concern..."
                                      className={`h-8 text-xs font-medium border-2 focus:border-primary bg-white shadow-inner flex-1 ${
                                        isReadOnly ? "cursor-not-allowed text-slate-500" : ""
                                      }`}
                                      value={itemRemarks[expense.id] || ""}
                                      onChange={(event) =>
                                        setItemRemarks((prev) => ({
                                          ...prev,
                                          [expense.id]: event.target.value,
                                        }))
                                      }
                                      disabled={isBusy || isReadOnly}
                                    />

                                    {!isReadOnly && (
                                      <Button
                                        size="sm"
                                        className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-md gap-2"
                                        disabled={
                                          processingItem === expense.id ||
                                          !itemRemarks[expense.id]?.trim()
                                        }
                                        onClick={() => handleSingleItemSubmit(expense)}
                                      >
                                        {processingItem === expense.id ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <Send size={12} />
                                        )}
                                        Submit Decision
                                      </Button>
                                    )}
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

                <div className="p-8 border-t bg-slate-50 flex items-center justify-end gap-12 relative shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                  <div className="w-80 flex flex-col gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Consolidation Summary</span>
                        <span className="text-blue-600">
                          {approvedCount} Draft Line{approvedCount !== 1 ? "s" : ""} Verified
                        </span>
                      </div>
                      <div className="h-[1px] bg-slate-100 w-full" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Approved Draft Total:
                        </span>
                        <span className="text-2xl font-black tabular-nums text-blue-700 tracking-tighter">
                          {formatCurrency(totalSelected)}
                        </span>
                      </div>
                      <Button
                        disabled={submitting || !hasEditableHeaderExpenses}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!hasEditableHeaderExpenses) {
                            return toast.info(
                              "This submittal is view-only because there are no Drafts items."
                            );
                          }

                          if (!hasAnyEditableDecision) {
                            return toast.warning(
                              "Please make at least one decision for a Drafts item before finalizing."
                            );
                          }

                          setConfirmOpen(true);
                        }}
                      >
                        {submitting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <ShieldCheck size={20} />
                        )}
                        {hasEditableHeaderExpenses ? "Finalize Batch" : "View Only"}
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="w-full py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={onClose}
                    >
                      {hasEditableHeaderExpenses ? "Discard Changes" : "Close"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">
                  Finalize Batch Submittal
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  You are about to consolidate {approvedCount} Drafts item
                  {approvedCount !== 1 ? "s" : ""}.
                </DialogDescription>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                  Batch Submission Remarks <span className="text-red-500">*</span>
                </label>
                <Textarea
                  rows={4}
                  className="rounded-3xl border-slate-200 text-sm focus:ring-blue-500/20 shadow-inner bg-slate-50/30 p-5"
                  placeholder="Provide the final audit justification for this batch..."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </div>

              {itemsMissingFeedback.length > 0 ? (
                <div className="p-6 bg-rose-50/50 rounded-[2rem] border border-rose-100 space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                    <MessageSquareWarning size={14} className="animate-pulse" />
                    Required Line-Item Feedback ({itemsMissingFeedback.length})
                  </label>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-rose-200">
                    {itemsMissingFeedback.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-white rounded-2xl border border-rose-100/50 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                            {item.particulars_name}
                          </span>
                          <span
                            className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                              itemDecisions[item.id] === "Rejected"
                                ? "bg-rose-100 text-rose-600"
                                : "bg-amber-100 text-amber-600"
                            }`}
                          >
                            {itemDecisions[item.id]}
                          </span>
                        </div>
                        <Textarea
                          rows={2}
                          className="bg-slate-50/50 border-slate-100 text-[11px] rounded-xl focus:ring-rose-500/10 resize-none shadow-inner"
                          placeholder={`Reason for ${itemDecisions[item.id]}...`}
                          value={itemRemarks[item.id] || ""}
                          onChange={(event) =>
                            setItemRemarks((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 border-dashed flex items-center gap-4">
                  <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-700 uppercase leading-none mb-1">
                      Audit Trails Clear
                    </p>
                    <p className="text-[9px] text-emerald-600/70 font-medium">
                      All required line-item justifications are complete.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-center text-muted-foreground font-medium italic px-4">
                {hasMissingFeedback
                  ? "Please provide feedback for the flagged items before confirming."
                  : hasPendingItems
                    ? "Note: Pending Drafts items will be skipped and remain in the draft pool."
                    : "This batch is ready for disbursement consolidation."}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-100"
                disabled={!remarks.trim() || submitting || hasMissingFeedback}
                onClick={handleConfirm}
              >
                {submitting ? <Loader2 className="animate-spin mr-2" /> : "Confirm Submittal"}
              </Button>
              <Button
                variant="ghost"
                className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400"
                onClick={() => setConfirmOpen(false)}
              >
                Back to Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(value) => !value && setPreviewUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] p-0 overflow-hidden bg-black border-none shadow-2xl flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setPreviewUrl(null)}
          >
            <X size={24} />
          </Button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-[90vw] max-h-[85vh] object-contain mx-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
