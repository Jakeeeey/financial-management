"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ExpenseSummaryItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
  ExpenseApproverOption,
} from "../types";
import {
  Inbox,
  ArrowLeft,
  User,
  Calendar,
  ChevronRight,
  FileText,
  CalendarDays,
  CalendarRange,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
} from "lucide-react";

interface ExpenseSummaryTableProps {
  expenses: ExpenseSummaryItem[];
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
  approvers?: ExpenseApproverOption[];
  selectedEncoderName?: string;
  onBackToEncoders?: () => void;
  onViewDetails: (item: ExpenseSummaryItem) => void;
}

export const ExpenseSummaryTable: React.FC<ExpenseSummaryTableProps> = ({
  expenses,
  suppliers,
  coas,
  divisions,
  departments,
  approvers = [],
  selectedEncoderName,
  onBackToEncoders,
  onViewDetails,
}) => {
  const [groupBy, setGroupBy] = useState<"receipt" | "day" | "week">("week");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");

  const getSupplierName = useCallback(
    (id: number) => {
      return suppliers.find((s) => s.id === id)?.supplier_name || `Supplier #${id}`;
    },
    [suppliers]
  );

  const getCoaName = useCallback(
    (id: number) => {
      const found = coas.find((c) => c.coa_id === id);
      return found ? `${found.gl_code || ""} - ${found.account_title || ""}` : `COA #${id}`;
    },
    [coas]
  );

  const getDivisionName = useCallback(
    (id?: number | null) => {
      if (!id) return "-";
      return divisions.find((d) => d.division_id === id)?.division_name || `Div #${id}`;
    },
    [divisions]
  );

  const getDepartmentName = useCallback(
    (id?: number | null) => {
      if (!id) return "-";
      return departments.find((d) => d.department_id === id)?.department_name || `Dept #${id}`;
    },
    [departments]
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const getWeekLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown Week";
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `Week ${weekNum} (${d.getFullYear()})`;
  };

  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, yearStr, monthStr, dayStr] = match;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = months[month] || "";
      return `${monthName} ${day} ${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
  };

  const getDayLabel = (dateStr: string) => {
    if (!dateStr) return "Unknown Date";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, yearStr, monthStr, dayStr] = match;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const d = new Date(year, month, day);
      const dayOfWeek = isNaN(d.getTime()) ? "" : days[d.getDay()];
      const monthName = months[month] || "";
      return `${dayOfWeek ? `${dayOfWeek}, ` : ""}${monthName} ${day}, ${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  // 1. Group expenses according to selected groupBy state
  const groupedData = useMemo(() => {
    if (groupBy === "receipt") {
      return expenses.map((item) => ({
        key: String(item.id),
        title: item.doc_no,
        subTitle: item.expense_date,
        items: [item],
        totalAmount: Number(item.amount || 0),
      }));
    }

    const groupsMap: Record<string, ExpenseSummaryItem[]> = {};

    expenses.forEach((item) => {
      const key =
        groupBy === "day"
          ? item.expense_date || "No Date"
          : getWeekLabel(item.expense_date);

      if (!groupsMap[key]) {
        groupsMap[key] = [];
      }
      groupsMap[key].push(item);
    });

    return Object.keys(groupsMap).map((key) => {
      const items = groupsMap[key];
      const title = groupBy === "day" ? getDayLabel(key) : key;
      const totalAmount = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      return { key, title, items, totalAmount };
    });
  }, [expenses, groupBy]);

  // 2. Currently active group object (defaults to first group if current key is invalid/empty)
  const activeGroup = useMemo(() => {
    if (groupedData.length === 0) return null;
    const exists = groupedData.some((g) => g.key === selectedGroupKey);
    const targetKey = exists ? selectedGroupKey : groupedData[0].key;
    return groupedData.find((g) => g.key === targetKey) || groupedData[0] || null;
  }, [groupedData, selectedGroupKey]);

  // Active group items for detail receipts table
  const activeGroupItems = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.items;
  }, [activeGroup]);

  const renderApprovalTierStepper = (
    currentLevel: number = 1,
    divisionId?: number | null,
    itemStatus?: string,
    isFinalApproved?: boolean | number
  ) => {
    // For Draft, show a dash
    if (itemStatus === "Draft") {
      return <span className="text-muted-foreground text-xs font-mono">-</span>;
    }
    if (itemStatus === "Rejected") {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" /> Rejected
        </Badge>
      );
    }

    const isApproved = itemStatus === "Submitted To Disbursement" || !!isFinalApproved;

    // Filter approvers matching this expense's division
    const divisionApprovers = approvers.filter((a) => {
      if (!divisionId || !a.division_id) return false;
      const divId = typeof a.division_id === "object" ? a.division_id.division_id : a.division_id;
      return Number(divId) === Number(divisionId);
    });

    // Calculate maximum hierarchy for this division (default to 3 if none configured)
    const highestHierarchy = divisionApprovers.reduce((max, a) => {
      const levelNum = Number(a.approver_hierarchy || 0);
      return levelNum > max ? levelNum : max;
    }, 0);

    const actualMaxLevels = highestHierarchy > 0 ? highestHierarchy : 3;
    const levels = Array.from({ length: actualMaxLevels }, (_, i) => i + 1);

    // If fully approved, all levels are considered passed
    const safeCurrent = isApproved ? actualMaxLevels + 1 : Math.max(1, currentLevel);

    const getApproverNameForLevel = (lvl: number) => {
      const match = divisionApprovers.find((a) => Number(a.approver_hierarchy) === lvl);
      if (match && match.approver_id && typeof match.approver_id === "object") {
        const fname = match.approver_id.user_fname || "";
        const lname = match.approver_id.user_lname || "";
        const fullName = `${fname} ${lname}`.trim();
        if (fullName) return fullName;
      }
      return null;
    };

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border shadow-2xs ${
        isApproved
          ? "bg-emerald-500/5 dark:bg-emerald-950/40 border-emerald-500/30"
          : "bg-background/80 dark:bg-zinc-950/80 border-blue-200 dark:border-blue-900/60"
      }`}>
        {levels.map((lvl, index) => {
          const isPassed = lvl < safeCurrent;
          const isActive = !isApproved && lvl === safeCurrent;
          const approverName = getApproverNameForLevel(lvl);

          return (
            <React.Fragment key={lvl}>
              {/* Connector Line */}
              {index > 0 && (
                <div
                  className={`h-0.5 w-1.5 transition-colors ${
                    isPassed
                      ? "bg-emerald-500"
                      : isActive
                      ? "bg-blue-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              )}

              {/* Individual Per-Node Tooltip */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help transition-transform hover:scale-110">
                      {isPassed ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs" title={`Tier ${lvl} Approved`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      ) : isActive ? (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 font-mono shadow-md shadow-blue-500/30 animate-pulse ring-2 ring-blue-400/40">
                          {lvl}
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 bg-muted/40 text-slate-400 dark:text-slate-500 flex items-center justify-center text-[9px] shrink-0 font-mono font-medium">
                          {lvl}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="p-2 text-xs bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xl z-50"
                  >
                    <div className="space-y-1">
                      <div className={`font-bold border-b pb-1 text-[11px] ${
                        isPassed
                          ? "text-emerald-400 dark:text-emerald-600 border-emerald-700/50"
                          : "text-blue-400 dark:text-blue-600 border-zinc-700 dark:border-zinc-300"
                      }`}>
                        Tier {lvl} of {actualMaxLevels} {isPassed ? "Approved" : "Approval"}
                      </div>
                      <div className="text-[11px]">
                        <span className="text-zinc-400 dark:text-zinc-500">Approver: </span>
                        <span className="font-bold text-white dark:text-zinc-900">
                          {approverName || `Tier ${lvl} Approver`}
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderStatusBadge = (item: ExpenseSummaryItem) => {
    if (item.status === "Submitted To Disbursement" || item.is_final_approved) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" /> Approved
        </Badge>
      );
    }
    if (item.status === "Pending Approval") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3" /> Pending Review
        </Badge>
      );
    }
    if (item.status === "With Concern") {
      return (
        <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" /> With Concern
        </Badge>
      );
    }
    if (item.status === "Rejected") {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" /> Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
        <FileText className="w-3 h-3" /> {item.status || "Draft"}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* SINGLE COMPACT FLEX HEADER (Back Button + Submitter Name + Group By + Inline Metrics) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 p-3.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          {onBackToEncoders && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToEncoders}
              className="h-8 text-xs gap-1.5 bg-background border border-border dark:border-zinc-700/80 hover:bg-muted font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to List
            </Button>
          )}

          {selectedEncoderName ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground border-l border-border/80 dark:border-zinc-700/80 pl-3">
              <User className="w-4 h-4 text-primary shrink-0" />
              <span>Submitted by:</span>
              <span className="text-primary font-bold">{selectedEncoderName}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Segmented Icon Toggle Group for Group By */}
          <div className="flex items-center gap-1 bg-muted/60 dark:bg-zinc-950 p-1 rounded-lg border border-border/80 dark:border-zinc-700/80">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGroupBy("receipt")}
              className={`h-7 w-7 rounded-md transition-all ${
                groupBy === "receipt"
                  ? "bg-background dark:bg-zinc-800 text-primary shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Group Per Receipt"
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGroupBy("day")}
              className={`h-7 w-7 rounded-md transition-all ${
                groupBy === "day"
                  ? "bg-background dark:bg-zinc-800 text-primary shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Group Per Day"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGroupBy("week")}
              className={`h-7 w-7 rounded-md transition-all ${
                groupBy === "week"
                  ? "bg-background dark:bg-zinc-800 text-primary shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Group Per Week"
            >
              <CalendarRange className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN MASTER-DETAIL SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[calc(100vh-285px)]">
        {/* LEFT COLUMN: MASTER GROUPS SELECTION LIST (3 Cols - 25%) */}
        <div className="lg:col-span-3 bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col min-h-[calc(100vh-285px)] space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-border/80 dark:border-zinc-700/80 text-xs shrink-0">
            <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">
                {groupBy === "receipt" && "Receipts List"}
                {groupBy === "day" && "Expense Days"}
                {groupBy === "week" && "Expense Weeks"}
              </span>
            </span>
            <Badge variant="secondary" className="text-[10px] font-mono border border-border/60 dark:border-zinc-700 shrink-0 ml-1">
              {groupedData.length} {groupedData.length === 1 ? "group" : "groups"}
            </Badge>
          </div>

          {/* Group Items Scroll Container */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-350px)] space-y-2 pr-1 pt-1">
            {groupedData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs italic border border-dashed border-border dark:border-zinc-700/80 rounded-lg">
                No expense groups found.
              </div>
            ) : (
              groupedData.map((group) => {
                const isSelected = activeGroup?.key === group.key;
                const groupHasConcern = group.items.some((i) => i.has_concern || i.status === "With Concern");

                return (
                  <div
                    key={group.key}
                    onClick={() => setSelectedGroupKey(group.key)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 group ${
                      isSelected
                        ? "bg-primary/10 border-2 border-primary shadow-xs"
                        : groupHasConcern
                        ? "bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/40 hover:bg-amber-500/20"
                        : "bg-muted/40 dark:bg-zinc-900/90 border-border/80 dark:border-zinc-700/80 hover:bg-muted/70 dark:hover:bg-zinc-800/90 hover:border-primary/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`font-bold truncate text-[11px] flex items-center gap-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {group.title}
                          {groupHasConcern && (
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Contains item with concern" />
                          )}
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                            isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground opacity-50"
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-1.5 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-mono bg-background/80 dark:bg-zinc-950 border border-border/60 dark:border-zinc-700 px-1.5 py-0"
                          >
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </Badge>
                          {groupHasConcern && (
                            <Badge variant="outline" className="text-[9px] font-mono bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 px-1 py-0">
                              Concern
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-500">
                          {formatCurrency(group.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL RECEIPTS TABLE (9 Cols - 75%) */}
        <div className="lg:col-span-9 flex flex-col min-h-[calc(100vh-285px)] space-y-3">
          {/* Receipts Data Table Container */}
          <div className="flex-1 flex flex-col rounded-xl border border-border dark:border-zinc-700/80 bg-card dark:bg-zinc-900/80 overflow-hidden shadow-xs min-h-[340px]">
            {/* Header info bar with active group title & total */}
            {activeGroup && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 dark:bg-zinc-900/60 border-b border-border/80 dark:border-zinc-700/80 text-xs shrink-0">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <span>{activeGroup.title}</span>
                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                    {activeGroup.items.length} {activeGroup.items.length === 1 ? "receipt" : "receipts"}
                  </Badge>
                </div>
                <div className="font-mono font-bold text-primary">
                  Group Total: {formatCurrency(activeGroup.totalAmount)}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-375px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/90 dark:bg-zinc-900 backdrop-blur-xs border-b border-border dark:border-zinc-700/80 shadow-xs">
                  <TableRow className="border-b border-border dark:border-zinc-700/80">
                    <TableHead className="w-[120px] font-bold text-foreground">Doc Code</TableHead>
                    <TableHead className="w-[95px] font-bold text-foreground">Date</TableHead>
                    <TableHead className="font-bold text-foreground">Payee / Supplier</TableHead>
                    <TableHead className="font-bold text-foreground">Division / Dept</TableHead>
                    <TableHead className="font-bold text-foreground">Chart of Accounts</TableHead>
                    <TableHead className="w-[110px] font-bold text-foreground">Approval Tier</TableHead>
                    <TableHead className="w-[130px] font-bold text-foreground">Status</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Amount</TableHead>
                    <TableHead className="text-center w-[85px] font-bold text-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeGroupItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-44 text-center text-muted-foreground text-xs">
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          <Inbox className="w-8 h-8 text-muted-foreground/50" />
                          <span>No expense receipts in this selected group.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeGroupItems.map((item) => {
                      const hasConcern = !!item.has_concern;
                      const divName = getDivisionName(item.division_id);
                      const deptName = getDepartmentName(item.department_id);

                      return (
                        <TableRow
                          key={item.id}
                          className={`border-b border-border/60 dark:border-zinc-700/70 transition-colors ${
                            hasConcern
                              ? "bg-amber-100/90 dark:bg-amber-950/70 border-l-4 border-l-amber-500 hover:bg-amber-200/90 dark:hover:bg-amber-900/80"
                              : "hover:bg-muted/50 dark:hover:bg-zinc-800/60"
                          }`}
                        >
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <div>{item.doc_no}</div>
                            {hasConcern && item.status !== "With Concern" && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold flex items-center gap-1 w-fit mt-1 py-0.5 px-2 shadow-xs"
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" /> With Concern
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            {formatDisplayDate(item.expense_date)}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {getSupplierName(item.payee)}
                            {item.is_employee ? (
                              <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Employee)</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium text-foreground truncate max-w-[130px]" title={divName}>
                              {divName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[130px]" title={deptName}>
                              {deptName}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[170px] truncate" title={getCoaName(item.coa_id)}>
                            {getCoaName(item.coa_id)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {renderApprovalTierStepper(
                              item.current_approval_level,
                              item.division_id,
                              item.status,
                              item.is_final_approved
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {renderStatusBadge(item)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm text-emerald-500">
                            {formatCurrency(Number(item.amount))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewDetails(item)}
                              className="h-7 text-xs gap-1 font-semibold bg-background hover:bg-muted"
                            >
                              <Eye className="w-3.5 h-3.5 text-primary" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
