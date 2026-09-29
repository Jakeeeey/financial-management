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
import { Input } from "@/components/ui/input";
import {
  ExpenseSummaryItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
} from "../types";
import {
  Search,
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
} from "lucide-react";

interface ExpenseSummaryTableProps {
  expenses: ExpenseSummaryItem[];
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
  selectedEncoderName?: string;
  onBackToEncoders?: () => void;
  onViewDetails: (item: ExpenseSummaryItem) => void;
}

export const ExpenseSummaryTable: React.FC<ExpenseSummaryTableProps> = ({
  expenses,
  suppliers,
  coas,
  selectedEncoderName,
  onBackToEncoders,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
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

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || "Unknown Date";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  // 4. Filter items in active group by search query
  const filteredActiveGroupItems = useMemo(() => {
    if (!activeGroup) return [];
    if (!searchTerm.trim()) return activeGroup.items;
    const q = searchTerm.toLowerCase();
    return activeGroup.items.filter((item) => {
      return (
        (item.doc_no || "").toLowerCase().includes(q) ||
        (getSupplierName(item.payee) || "").toLowerCase().includes(q) ||
        (getCoaName(item.coa_id) || "").toLowerCase().includes(q) ||
        (item.remarks || "").toLowerCase().includes(q)
      );
    });
  }, [activeGroup, searchTerm, getSupplierName, getCoaName]);

  // Total amount across all items for this encoder
  const totalEncoderAmount = useMemo(() => {
    return expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenses]);

  const renderStatusBadge = (item: ExpenseSummaryItem) => {
    if (item.status === "Submitted To Disbursement" || item.is_final_approved) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" /> Approved / Disbursement
        </Badge>
      );
    }
    if (item.status === "Pending Approval") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3" /> Pending Approval
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

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
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

          {/* Compact Right-Side Financial Metric Pills */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border border-amber-500/30 dark:border-amber-500/50 px-2.5 py-1 text-xs">
              {expenses.length} {expenses.length === 1 ? "Receipt Record" : "Receipt Records"}
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 dark:border-emerald-500/50 px-2.5 py-1 text-xs font-bold">
              Total Amount: {formatCurrency(totalEncoderAmount)}
            </Badge>
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
          {/* Detail Search Control Bar */}
          <div className="flex items-center justify-between gap-3 bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 p-3.5 rounded-xl shadow-xs shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search doc code, payee, COA in this group..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border border-border dark:border-zinc-700/80 text-xs"
              />
            </div>

            {activeGroup && (
              <div className="text-xs font-mono font-bold text-primary hidden sm:block">
                Group Total: {formatCurrency(activeGroup.totalAmount)}
              </div>
            )}
          </div>

          {/* Receipts Data Table Container */}
          <div className="flex-1 flex flex-col rounded-xl border border-border dark:border-zinc-700/80 bg-card dark:bg-zinc-900/80 overflow-hidden shadow-xs min-h-[340px]">
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-375px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/90 dark:bg-zinc-900 backdrop-blur-xs border-b border-border dark:border-zinc-700/80 shadow-xs">
                  <TableRow className="border-b border-border dark:border-zinc-700/80">
                    <TableHead className="w-[120px] font-bold text-foreground">Doc Code</TableHead>
                    <TableHead className="w-[100px] font-bold text-foreground">Date</TableHead>
                    <TableHead className="font-bold text-foreground">Payee / Supplier</TableHead>
                    <TableHead className="font-bold text-foreground">Chart of Accounts</TableHead>
                    <TableHead className="w-[130px] font-bold text-foreground">Status</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Amount</TableHead>
                    <TableHead className="text-center w-[90px] font-bold text-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActiveGroupItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-muted-foreground text-xs">
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          <Inbox className="w-8 h-8 text-muted-foreground/50" />
                          <span>No expense receipts in this selected group.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActiveGroupItems.map((item) => {
                      const hasConcern = !!item.has_concern;
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
                          <TableCell className="text-xs">{item.expense_date}</TableCell>
                          <TableCell className="font-medium text-xs">
                            {getSupplierName(item.payee)}
                            {item.is_employee ? (
                              <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Employee)</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate" title={getCoaName(item.coa_id)}>
                            {getCoaName(item.coa_id)}
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
