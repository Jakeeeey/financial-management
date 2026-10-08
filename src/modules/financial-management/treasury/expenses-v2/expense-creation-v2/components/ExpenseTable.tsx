"use client";

import React, { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ExpenseItem,
  ExpenseStatus,
  SupplierOption,
  ChartOfAccountOption,
  DivisionOption,
  DepartmentOption,
  ExpenseApproverOption,
} from "../types";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  Search,
  History,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  ExternalLink,
  Image as ImageIcon,
  Check,
} from "lucide-react";

interface ExpenseTableProps {
  expenses: ExpenseItem[];
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  approvers?: ExpenseApproverOption[];
  onOpenHistory: (item: ExpenseItem) => void;
  onOpenRevision: (item: ExpenseItem) => void;
  onSubmitDraft: (id: number) => void;
  onDeleteExpense: (id: number) => void;
  activeTab: string;
}

const ALL_MONTH_VALUES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  suppliers,
  coas,
  divisions,
  departments,
  approvers = [],
  onOpenHistory,
  onOpenRevision,
  onSubmitDraft,
  onDeleteExpense,
  activeTab,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [groupBy, setGroupBy] = useState<"receipt" | "day" | "week">("week");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>(ALL_MONTH_VALUES);

  React.useEffect(() => {
    if (groupBy === "week") {
      setSelectedYear("");
      setSelectedMonths([]);
    } else {
      setSelectedYear((prev) => (prev === "" ? "all" : prev));
      setSelectedMonths((prev) => (prev.length === 0 ? ALL_MONTH_VALUES : prev));
    }
  }, [groupBy]);

  const handleToggleMonth = (monthVal: string) => {
    setSelectedMonths((prev) =>
      prev.includes(monthVal)
        ? prev.filter((m) => m !== monthVal)
        : [...prev, monthVal]
    );
  };

  const handleSelectAllMonths = () => {
    setSelectedMonths(ALL_MONTH_VALUES);
  };

  const handleUnselectAllMonths = () => {
    setSelectedMonths([]);
  };

  const getMonthTriggerLabel = () => {
    if (groupBy === "week") return "Month";
    if (selectedMonths.length === 0) return "No Month";
    if (selectedMonths.length === 12) return "All Months";
    if (selectedMonths.length === 1) {
      const found = MONTH_OPTIONS.find((m) => m.value === selectedMonths[0]);
      return found ? found.label : "1 Month";
    }
    return `${selectedMonths.length} Months`;
  };

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    const currentYr = String(new Date().getFullYear());
    set.add(currentYr);
    expenses.forEach((item) => {
      if (item.expense_date) {
        const match = item.expense_date.match(/^(\d{4})/);
        if (match) set.add(match[1]);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const [selectedReceiptModal, setSelectedReceiptModal] = useState<{
    url: string;
    docNo?: string;
  } | null>(null);

  const [actionConfirmModal, setActionConfirmModal] = useState<{
    type: "submit" | "delete";
    item: ExpenseItem;
  } | null>(null);

  const getRowBgClass = (status: ExpenseStatus) => {
    switch (status) {
      case "Pending Approval":
        return "bg-blue-100/90 dark:bg-blue-950/70 border-l-4 border-l-blue-500 hover:bg-blue-200/90 dark:hover:bg-blue-900/80 transition-colors";
      case "Submitted To Disbursement":
        return "bg-emerald-100/90 dark:bg-emerald-950/70 border-l-4 border-l-emerald-500 hover:bg-emerald-200/90 dark:hover:bg-emerald-900/80 transition-colors";
      case "With Concern":
        return "bg-amber-100/90 dark:bg-amber-950/70 border-l-4 border-l-amber-500 hover:bg-amber-200/90 dark:hover:bg-amber-900/80 transition-colors";
      case "Rejected":
        return "bg-rose-100/90 dark:bg-rose-950/70 border-l-4 border-l-rose-500 hover:bg-rose-200/90 dark:hover:bg-rose-900/80 transition-colors";
      default:
        return "hover:bg-muted/30 transition-colors";
    }
  };

  const getCardBgClass = (status: ExpenseStatus) => {
    switch (status) {
      case "Pending Approval":
        return "bg-blue-50/80 dark:bg-blue-950/50 border-l-4 border-l-blue-500 border-blue-200/70 dark:border-blue-900/70 hover:border-blue-400";
      case "Submitted To Disbursement":
        return "bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500 border-emerald-200/60 dark:border-emerald-900/60 hover:border-emerald-400";
      case "With Concern":
        return "bg-amber-50/80 dark:bg-amber-950/50 border-l-4 border-l-amber-500 border-amber-200/70 dark:border-amber-900/70 hover:border-amber-400";
      case "Rejected":
        return "bg-rose-50/70 dark:bg-rose-950/40 border-l-4 border-l-rose-500 border-rose-200/60 dark:border-rose-900/60 hover:border-rose-400";
      default:
        return "bg-card border border-border/60 hover:border-primary/40";
    }
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const getSupplierName = React.useCallback(
    (id: number) => {
      return suppliers.find((s) => s.id === id)?.supplier_name || `Supplier #${id}`;
    },
    [suppliers]
  );

  const getCoaName = React.useCallback(
    (id: number) => {
      const found = coas.find((c) => c.coa_id === id);
      return found ? `${found.gl_code || ""} - ${found.account_title || ""}` : `COA #${id}`;
    },
    [coas]
  );

  const getDivisionName = React.useCallback(
    (id?: number | null) => {
      if (!id) return "-";
      return divisions.find((d) => d.division_id === id)?.division_name || `Division #${id}`;
    },
    [divisions]
  );

  const getDepartmentName = React.useCallback(
    (id?: number | null) => {
      if (!id) return "-";
      return departments.find((d) => d.department_id === id)?.department_name || `Department #${id}`;
    },
    [departments]
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const getStatusBadge = (status: ExpenseStatus, isResubmitted?: boolean | number) => {
    const resubBadge = isResubmitted ? (
      <Badge variant="outline" className="ml-1 bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
        RESUBMITTED
      </Badge>
    ) : null;

    switch (status) {
      case "Draft":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
              Draft
            </Badge>
          </div>
        );
      case "Pending Approval":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 font-bold">
              Pending Approval
            </Badge>
            {resubBadge}
          </div>
        );
      case "Submitted To Disbursement":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold">
              Approved
            </Badge>
          </div>
        );
      case "With Concern":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 font-bold">
              Needs Revision
            </Badge>
          </div>
        );
      case "Rejected":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/50 font-bold">
              Rejected
            </Badge>
          </div>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const renderApprovalTierStepper = (
    currentLevel: number = 1,
    divisionId?: number | null
  ) => {
    const safeCurrent = Math.max(1, currentLevel);

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
      <div className="inline-flex items-center gap-1 bg-background/80 dark:bg-zinc-950/80 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-900/60 shadow-2xs">
        {levels.map((lvl, index) => {
          const isPassed = lvl < safeCurrent;
          const isActive = lvl === safeCurrent;
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
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
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
                    className="p-2 text-xs bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xl"
                  >
                    <div className="space-y-1">
                      <div className="font-bold border-b border-zinc-700 dark:border-zinc-300 pb-1 text-[11px] text-blue-400 dark:text-blue-600">
                        Tier {lvl} of {actualMaxLevels} Approval
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

  // Helper to format ISO week number
  const getWeekLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown Week";
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `Week ${weekNum} (${d.getFullYear()})`;
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
      return `${monthName} ${day}, ${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Filter expenses based on tab and search term
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // Tab Filter
      let tabMatch = true;
      if (activeTab === "draft") tabMatch = item.status === "Draft";
      if (activeTab === "pending") tabMatch = item.status === "Pending Approval";
      if (activeTab === "concern") tabMatch = item.status === "With Concern";
      if (activeTab === "approved") tabMatch = item.status === "Submitted To Disbursement";
      if (activeTab === "rejected") tabMatch = item.status === "Rejected";

      if (!tabMatch) return false;

      // Year & Month Filter (Only active when groupBy != 'week')
      if (groupBy !== "week") {
        if (selectedYear && selectedYear !== "all") {
          const yr = item.expense_date?.slice(0, 4);
          if (yr !== selectedYear) return false;
        }
        if (selectedMonths.length === 0) {
          return false;
        }
        if (selectedMonths.length < 12) {
          const mo = item.expense_date?.slice(5, 7);
          if (!mo || !selectedMonths.includes(mo)) return false;
        }
      }

      // Search Filter (Includes doc_no, payee, coa, division, department, and remarks)
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      return (
        (item.doc_no || "").toLowerCase().includes(query) ||
        (getSupplierName(item.payee) || "").toLowerCase().includes(query) ||
        (getCoaName(item.coa_id) || "").toLowerCase().includes(query) ||
        (getDivisionName(item.division_id) || "").toLowerCase().includes(query) ||
        (getDepartmentName(item.department_id) || "").toLowerCase().includes(query) ||
        (item.remarks || "").toLowerCase().includes(query)
      );
    });
  }, [
    expenses,
    activeTab,
    searchTerm,
    getSupplierName,
    getCoaName,
    getDivisionName,
    getDepartmentName,
    groupBy,
    selectedYear,
    selectedMonths,
  ]);

  // Group expenses according to selected groupBy state
  const groupedData = useMemo(() => {
    if (groupBy === "receipt") {
      const totalAmount = filteredExpenses.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      return [{ key: "all", title: "All Receipts", items: filteredExpenses, totalAmount }];
    }

    const groupsMap: Record<string, ExpenseItem[]> = {};

    filteredExpenses.forEach((item) => {
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
  }, [filteredExpenses, groupBy]);

  const renderActionButtons = (item: ExpenseItem) => (
    <div className="flex items-center justify-center gap-1">
      {/* View History Log */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="View Audit History"
        onClick={() => onOpenHistory(item)}
      >
        <History className="w-4 h-4" />
      </Button>

      {/* View Receipt Image Modal Trigger */}
      {item.receipt_url ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="View Receipt Image"
          onClick={() => setSelectedReceiptModal({ url: item.receipt_url!, docNo: item.doc_no })}
        >
          <FileText className="w-4 h-4" />
        </Button>
      ) : null}

      {/* Submit Draft */}
      {item.status === "Draft" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          title="Submit to Approval"
          onClick={() => setActionConfirmModal({ type: "submit", item })}
        >
          <Send className="w-4 h-4" />
        </Button>
      ) : null}

      {/* Edit / Resubmit Revision */}
      {item.status === "With Concern" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 animate-pulse"
          title="Edit & Resubmit Revision"
          onClick={() => onOpenRevision(item)}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      ) : null}

      {/* Delete (Draft only) */}
      {item.status === "Draft" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
          title="Delete Draft"
          onClick={() => setActionConfirmModal({ type: "delete", item })}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  );


  // Global Expand / Collapse state
  const isAllCollapsed = useMemo(() => {
    if (groupedData.length === 0) return false;
    return groupedData.every((g) => collapsedGroups[g.key]);
  }, [groupedData, collapsedGroups]);

  const toggleExpandAll = () => {
    if (isAllCollapsed) {
      setCollapsedGroups({});
    } else {
      const next: Record<string, boolean> = {};
      groupedData.forEach((g) => {
        next[g.key] = true;
      });
      setCollapsedGroups(next);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Search Bar, Group By Filter, Expand/Collapse Toggle, and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-xl border border-border/60">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search code, payee, COA, remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/60 border-border/60 text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          {/* Year & Month Filters (Disabled & Cleared when GroupBy is 'week') */}
          <div className="flex items-center gap-1.5">
            {/* Year Filter */}
            <Select
              value={groupBy === "week" ? "" : selectedYear}
              onValueChange={(val) => setSelectedYear(val)}
              disabled={groupBy === "week"}
            >
              <SelectTrigger className="h-8 text-xs bg-background/60 w-28 border-border/60 disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue placeholder={groupBy === "week" ? "Year" : "Select Year"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-[100]">
                <SelectItem value="all" className="text-xs font-semibold">All Years</SelectItem>
                {availableYears.map((yr) => (
                  <SelectItem key={yr} value={yr} className="text-xs">
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Multi-Select Month Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={groupBy === "week"}
                  className="h-8 text-xs bg-background/60 border-border/60 justify-between min-w-[128px] px-2.5 font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{getMonthTriggerLabel()}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md">
                {/* Header & Quick Action Buttons */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Months ({selectedMonths.length}/12)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllMonths}
                      className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10"
                    >
                      Select All
                    </Button>
                    <span className="text-muted-foreground/40 text-xs">•</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUnselectAllMonths}
                      className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* 12 Months Checkbox List */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {MONTH_OPTIONS.map((m) => {
                    const isChecked = selectedMonths.includes(m.value);
                    return (
                      <div
                        key={m.value}
                        onClick={() => handleToggleMonth(m.value)}
                        className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-xs transition-colors"
                      >
                        <Checkbox
                          id={`month-${m.value}`}
                          checked={isChecked}
                          onCheckedChange={() => handleToggleMonth(m.value)}
                        />
                        <label
                          htmlFor={`month-${m.value}`}
                          className="text-xs font-medium cursor-pointer leading-none flex-1"
                        >
                          {m.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Group By Icon Toggle Group */}
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
              title="Per Receipt"
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
              title="Per Day"
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
              title="Per Week"
            >
              <CalendarRange className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Expand / Collapse All Button (Visible when GroupBy != 'receipt') */}
          {groupBy !== "receipt" && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-8 text-xs px-2.5 bg-background/60 border-border/60"
              title={isAllCollapsed ? "Expand All Groups" : "Collapse All Groups"}
            >
              {isAllCollapsed ? "Expand All" : "Collapse All"}
            </Button>
          )}

          {/* View Mode Switcher Buttons */}
          <div className="flex items-center border border-border/60 rounded-lg p-0.5 bg-background/60">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-7 px-2.5 text-xs gap-1.5"
              title="Table View"
            >
              <List className="w-3.5 h-3.5" /> Table
            </Button>
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="h-7 px-2.5 text-xs gap-1.5"
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </Button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: TABLE VIEW WITH ACCORDION GROUPINGS & STATUS ROW HIGHLIGHTS */}
      {viewMode === "table" && (
        <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[120px]">Doc Code</TableHead>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Payee / Supplier</TableHead>
                <TableHead>Chart of Accounts</TableHead>
                <TableHead>Division / Dept</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]">Tier</TableHead>
                <TableHead className="text-center w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    No expense receipts found.
                  </TableCell>
                </TableRow>
              ) : (
                groupedData.map((group) => {
                  const isCollapsed = collapsedGroups[group.key];
                  return (
                    <React.Fragment key={group.key}>
                      {/* Accordion Group Header (Only if GroupBy is NOT 'receipt') */}
                      {groupBy !== "receipt" && (
                        <TableRow
                          onClick={() => toggleGroup(group.key)}
                          className="bg-muted/60 hover:bg-muted/80 cursor-pointer font-medium border-y border-border/60 transition-colors"
                        >
                          <TableCell colSpan={9} className="py-2.5 px-4">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span className="font-semibold text-foreground">{group.title}</span>
                                <Badge variant="secondary" className="text-[10px] ml-1">
                                  {group.items.length} {group.items.length === 1 ? "receipt" : "receipts"}
                                </Badge>
                              </div>
                              <div className="font-mono font-bold text-primary">
                                Total: {formatCurrency(group.totalAmount || 0)}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Group Item Rows (Hidden if Collapsed) */}
                      {!isCollapsed &&
                        group.items.map((item) => (
                          <TableRow key={item.id} className={getRowBgClass(item.status)}>
                            <TableCell className="font-mono text-xs font-bold text-primary">
                              {item.doc_no}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{formatDisplayDate(item.expense_date)}</TableCell>
                            <TableCell className="font-medium text-xs">
                              {getSupplierName(item.payee)}
                              {item.is_employee ? (
                                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Employee)</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate font-medium" title={getCoaName(item.coa_id)}>
                              {getCoaName(item.coa_id)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">
                              {getDivisionName(item.division_id)} / {getDepartmentName(item.department_id)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-sm">
                              {formatCurrency(Number(item.amount))}
                            </TableCell>
                            <TableCell>{getStatusBadge(item.status, item.is_resubmitted)}</TableCell>
                            <TableCell>
                              {item.status === "Pending Approval" ? (
                                renderApprovalTierStepper(item.current_approval_level || 1, item.division_id)
                              ) : (
                                <span className="text-muted-foreground/40 text-xs font-mono">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{renderActionButtons(item)}</TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* VIEW MODE 2: CARDS GRID VIEW WITH ACCORDION GROUPINGS */}
      {viewMode === "cards" && (
        <div className="space-y-6">
          {filteredExpenses.length === 0 ? (
            <div className="h-48 flex items-center justify-center border border-border/60 rounded-xl bg-card/20 text-muted-foreground text-xs">
              No expense receipts found.
            </div>
          ) : (
            groupedData.map((group) => {
              const isCollapsed = collapsedGroups[group.key];
              return (
                <div key={group.key} className="space-y-3">
                  {/* Group Header for Cards (Only if GroupBy is NOT 'receipt') */}
                  {groupBy !== "receipt" && (
                    <div
                      onClick={() => toggleGroup(group.key)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-border/60 cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{group.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {group.items.length} {group.items.length === 1 ? "receipt" : "receipts"}
                        </Badge>
                      </div>
                      <div className="font-mono text-xs font-bold text-primary">
                        Total: {formatCurrency(group.totalAmount || 0)}
                      </div>
                    </div>
                  )}

                  {/* Cards Grid Container */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl p-4 space-y-3 shadow-xs transition-all hover:shadow-md relative group ${getCardBgClass(item.status)}`}
                        >
                          {/* Card Header: Doc Code & Status */}
                          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                            <span className="font-mono text-xs font-bold text-primary">{item.doc_no}</span>
                            <div className="flex items-center gap-1">
                              {getStatusBadge(item.status, item.is_resubmitted)}
                              {item.status === "Pending Approval" && (
                                renderApprovalTierStepper(item.current_approval_level || 1, item.division_id)
                              )}
                            </div>
                          </div>

                          {/* Card Main Info */}
                          <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <h4 className="font-semibold text-sm truncate" title={getSupplierName(item.payee)}>
                                {getSupplierName(item.payee)}
                              </h4>
                              <span className="font-mono text-base font-bold text-foreground shrink-0">
                                {formatCurrency(Number(item.amount))}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground truncate" title={getCoaName(item.coa_id)}>
                              GL: {getCoaName(item.coa_id)}
                            </p>
                          </div>

                          {/* Card Meta details */}
                          <div className="text-[11px] text-muted-foreground/80 space-y-1 bg-background/50 backdrop-blur-xs p-2 rounded-md font-mono border border-border/30">
                            <div className="flex justify-between">
                              <span>Date:</span>
                              <span className="text-foreground">{formatDisplayDate(item.expense_date)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Division/Dept:</span>
                              <span className="text-foreground truncate max-w-[140px]">
                                {getDivisionName(item.division_id)} / {getDepartmentName(item.department_id)}
                              </span>
                            </div>
                            {item.remarks ? (
                              <div className="text-[10px] italic text-muted-foreground truncate pt-0.5 border-t border-border/30 mt-1">
                                &quot;{item.remarks}&quot;
                              </div>
                            ) : null}
                          </div>

                          {/* Card Action Footer */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                            {item.receipt_url ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptModal({ url: item.receipt_url!, docNo: item.doc_no })}
                                className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-primary" /> View Receipt
                              </button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">No image attachment</span>
                            )}
                            <div>{renderActionButtons(item)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Interactive Receipt Zoom Modal */}
      <ReceiptZoomModal
        isOpen={!!selectedReceiptModal}
        onClose={() => setSelectedReceiptModal(null)}
        receiptUrl={selectedReceiptModal?.url}
        docNo={selectedReceiptModal?.docNo}
      />

      {/* Action Confirmation Dialog (Submit / Delete Draft) */}
      <Dialog
        open={!!actionConfirmModal}
        onOpenChange={(open) => !open && setActionConfirmModal(null)}
      >
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  actionConfirmModal?.type === "submit"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                {actionConfirmModal?.type === "submit" ? (
                  <Send className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                {actionConfirmModal?.type === "submit"
                  ? "Submit Draft for Approval"
                  : "Delete Draft Receipt"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-2 leading-relaxed">
              {actionConfirmModal?.type === "submit"
                ? "Are you sure you want to submit this draft receipt for approval? Once submitted, it will be forwarded to the assigned approvers for review."
                : "Are you sure you want to delete this draft receipt? This action is permanent and cannot be undone."}
            </DialogDescription>
          </DialogHeader>

          {/* Compact Summary Card */}
          {actionConfirmModal?.item && (
            <div className="my-2 p-3 bg-muted/40 rounded-lg border border-border space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-mono text-[11px]">
                  {actionConfirmModal.item.doc_no || "Draft Receipt"}
                </span>
                <span className="font-bold text-foreground">
                  ₱{Number(actionConfirmModal.item.amount || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-muted-foreground truncate">
                <span className="font-medium text-foreground">Payee/Supplier:</span>{" "}
                {getSupplierName(actionConfirmModal.item.payee) || "N/A"}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActionConfirmModal(null)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className={`text-xs font-semibold text-white ${
                actionConfirmModal?.type === "submit"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
              onClick={() => {
                if (!actionConfirmModal) return;
                const { type, item } = actionConfirmModal;
                setActionConfirmModal(null);
                if (type === "submit" && onSubmitDraft) {
                  onSubmitDraft(item.id);
                } else if (type === "delete" && onDeleteExpense) {
                  onDeleteExpense(item.id);
                }
              }}
            >
              {actionConfirmModal?.type === "submit"
                ? "Yes, Submit Receipt"
                : "Yes, Delete Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseTable;

// Standalone High-Performance Receipt Zoom Modal Component
interface ReceiptZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl?: string;
  docNo?: string;
}

const ReceiptZoomModal: React.FC<ReceiptZoomModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  docNo,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const rAFRef = React.useRef<number | null>(null);

  const updateDOMTransform = (scale: number, x: number, y: number) => {
    if (imgRef.current) {
      imgRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${scale})`;
    }
  };

  const resetPanZoom = React.useCallback(() => {
    setZoomScale(1);
    posRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    updateDOMTransform(1, 0, 0);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      resetPanZoom();
    }
  }, [isOpen, resetPanZoom]);

  const handleZoomIn = () => {
    setZoomScale((prev) => {
      const next = Math.min(Number((prev + 0.25).toFixed(2)), 4);
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 0.5);
      if (next <= 1) {
        posRef.current = { x: 0, y: 0 };
      }
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else if (e.deltaY > 0) {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    posRef.current = { x: newX, y: newY };

    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }
    rAFRef.current = requestAnimationFrame(() => {
      updateDOMTransform(zoomScale, newX, newY);
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] max-h-[92vh] p-0 overflow-hidden bg-card border-border flex flex-col">
        {/* Compact Header with Pan & Zoom Controls */}
        <DialogHeader className="p-2.5 px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
              <DialogTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Receipt Attachment Preview</span>
                {docNo && (
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 bg-background">
                    {docNo}
                  </Badge>
                )}
              </DialogTitle>
            </div>

            {/* Interactive Zoom Toolbar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-background/90 dark:bg-zinc-900 border border-border p-0.5 rounded-lg shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 0.5}
                  className="h-6 w-6 rounded-md"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>

                <span className="font-mono text-[11px] font-bold text-foreground px-1.5 min-w-[44px] text-center select-none">
                  {Math.round(zoomScale * 100)}%
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  className="h-6 w-6 rounded-md"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetPanZoom}
                  className="h-6 text-[10px] font-semibold gap-1 px-2 text-muted-foreground hover:text-foreground border-l border-border/80 rounded-none rounded-r-md"
                  title="Reset Zoom & Drag Position"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
              </div>

              {receiptUrl && (
                <a
                  href={getAssetUrl(receiptUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 mr-6"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Draggable & Zoomable Viewport Container */}
        <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`p-3 bg-zinc-950/95 flex items-center justify-center flex-1 min-h-[480px] max-h-[82vh] overflow-hidden select-none relative ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {zoomScale > 1 && (
            <div className="absolute top-2 left-2 z-10 bg-black/60 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 pointer-events-none">
              <Move className="w-3 h-3 text-amber-400" /> Click & Drag to explore all corners
            </div>
          )}

          {receiptUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={imgRef}
              src={getAssetUrl(receiptUrl)}
              alt="Receipt Attachment"
              draggable={false}
              style={{
                willChange: "transform",
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl border border-zinc-800/80 pointer-events-auto origin-center transition-none"
            />
          ) : (
            <p className="text-xs text-zinc-400 italic">No receipt image URL found.</p>
          )}
        </div>

        {/* Compact Footer */}
        <DialogFooter className="p-2 px-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            Use mouse wheel to zoom • Drag image to view all corners
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs font-semibold px-4"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
