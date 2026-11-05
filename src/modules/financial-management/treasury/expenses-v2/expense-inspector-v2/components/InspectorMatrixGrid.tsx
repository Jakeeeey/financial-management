"use client";

import React, { useMemo } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ExpenseItem,
  ChartOfAccountOption,
  GridViewMode,
  MatrixCellData,
} from "../types";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  AlertTriangle,
  XCircle,
  ImageOff,
  Inbox,
  Eye,
  FileText,
  ChevronRight,
} from "lucide-react";

interface InspectorMatrixGridProps {
  expenses: ExpenseItem[];
  coas: ChartOfAccountOption[];
  viewMode: GridViewMode;
  onSelectExpense: (item: ExpenseItem) => void;
  selectedEncoderName?: string;
  dateFrom?: string;
  dateTo?: string;
  isCoaEmpty?: boolean;
  activeSearch?: string;
}

export const InspectorMatrixGrid: React.FC<InspectorMatrixGridProps> = ({
  expenses,
  coas,
  viewMode,
  onSelectExpense,
  selectedEncoderName,
  dateFrom,
  dateTo,
  isCoaEmpty = false,
  activeSearch = "",
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = months[month] || parts[1];
      return `${monthName} ${day}, ${year}`;
    }
    return dateStr;
  };

  // 1. Generate continuous calendar dates between dateFrom and dateTo (Descending: latest to oldest)
  const columnsDates = useMemo(() => {
    const datesSet = new Set<string>();

    if (dateFrom && dateTo) {
      const pFrom = dateFrom.split("-").map((v) => parseInt(v, 10));
      const pTo = dateTo.split("-").map((v) => parseInt(v, 10));

      if (pFrom.length === 3 && pTo.length === 3) {
        let startUtc = Date.UTC(pFrom[0], pFrom[1] - 1, pFrom[2]);
        let endUtc = Date.UTC(pTo[0], pTo[1] - 1, pTo[2]);

        if (startUtc > endUtc) {
          const temp = startUtc;
          startUtc = endUtc;
          endUtc = temp;
        }

        const pad = (n: number) => String(n).padStart(2, "0");
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (let t = startUtc; t <= endUtc; t += oneDayMs) {
          const d = new Date(t);
          const y = d.getUTCFullYear();
          const m = pad(d.getUTCMonth() + 1);
          const day = pad(d.getUTCDate());
          datesSet.add(`${y}-${m}-${day}`);
        }
      }
    }

    // Include any existing expense dates that might fall outside
    expenses.forEach((item) => {
      if (item.expense_date) {
        datesSet.add(item.expense_date);
      }
    });

    const arr = Array.from(datesSet);
    // Sort descending (latest date on the left, oldest to the right)
    return arr.sort((a, b) => b.localeCompare(a));
  }, [expenses, dateFrom, dateTo]);

  // 2. Build fast lookup map: (coa_id -> (dateKey -> MatrixCellData))
  // and compute each COA's total amount and each Date's total amount
  const { coaRows, dateColumnTotals, grandTotal } = useMemo(() => {
    const coaDataMap = new Map<
      number,
      {
        totalAmount: number;
        receiptCount: number;
        dateCellMap: Map<string, MatrixCellData>;
      }
    >();

    const dateTotals = new Map<string, { totalAmount: number; count: number }>();
    let overallGrandTotal = 0;

    // Initialize all active COAs
    coas.forEach((coa) => {
      coaDataMap.set(coa.coa_id, {
        totalAmount: 0,
        receiptCount: 0,
        dateCellMap: new Map<string, MatrixCellData>(),
      });
    });

    // Populate with expenses
    expenses.forEach((item) => {
      const amt = Number(item.amount || 0);
      overallGrandTotal += amt;

      const dateKey = item.expense_date || "Unknown Date";

      // Track Date column totals
      const dCurr = dateTotals.get(dateKey) || { totalAmount: 0, count: 0 };
      dCurr.totalAmount += amt;
      dCurr.count += 1;
      dateTotals.set(dateKey, dCurr);

      // Track COA row data
      let cData = coaDataMap.get(item.coa_id);
      if (!cData) {
        cData = {
          totalAmount: 0,
          receiptCount: 0,
          dateCellMap: new Map<string, MatrixCellData>(),
        };
        coaDataMap.set(item.coa_id, cData);
      }

      cData.totalAmount += amt;
      cData.receiptCount += 1;

      const cell = cData.dateCellMap.get(dateKey) || {
        items: [],
        totalAmount: 0,
        count: 0,
        hasConcern: false,
        hasRejected: false,
      };

      cell.items.push(item);
      cell.totalAmount += amt;
      cell.count += 1;
      if (item.has_concern || item.status === "With Concern") cell.hasConcern = true;
      if (item.status === "Rejected") cell.hasRejected = true;

      cData.dateCellMap.set(dateKey, cell);
    });

    // Map coas array into rows and SORT DESCENDING BY TOTAL AMOUNT (highest amount first)
    const rows = coas.map((coa) => {
      const cData = coaDataMap.get(coa.coa_id) || {
        totalAmount: 0,
        receiptCount: 0,
        dateCellMap: new Map<string, MatrixCellData>(),
      };

      return {
        coa,
        totalAmount: cData.totalAmount,
        receiptCount: cData.receiptCount,
        dateCellMap: cData.dateCellMap,
      };
    });

    // Sort by totalAmount descending (highest to lowest)
    rows.sort((a, b) => b.totalAmount - a.totalAmount);

    // If a search query is active, filter out empty rows so user only sees accounts with matches
    const displayRows = activeSearch.trim()
      ? rows.filter((r) => r.receiptCount > 0)
      : rows;

    return {
      coaRows: displayRows,
      dateColumnTotals: dateTotals,
      grandTotal: overallGrandTotal,
    };
  }, [coas, expenses, activeSearch]);

  // Feedback when 0 accounts are checked in COA filter
  if (isCoaEmpty) {
    return (
      <div className="bg-card dark:bg-zinc-900/80 border border-dashed border-amber-500/40 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">No Chart of Accounts Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            All accounts are currently cleared. Please select or check at least one account in the COA filter dropdown above.
          </p>
        </div>
      </div>
    );
  }

  if (columnsDates.length === 0 || coaRows.length === 0) {
    return (
      <div className="bg-card dark:bg-zinc-900/80 border border-border/80 dark:border-zinc-700/80 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-muted/60 dark:bg-zinc-800 flex items-center justify-center text-muted-foreground">
          <Inbox className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">No Expense Records Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Try adjusting your search query, selecting another encoder, or changing the date range filter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Table Header Summary Bar - matching Expense Summary V2 header strip */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            {selectedEncoderName ? `${selectedEncoderName}'s Expenses` : "Expenses Matrix"}
          </span>
          <Badge variant="secondary" className="text-[10px] font-mono border border-slate-200 dark:border-zinc-700 px-1.5 py-0">
            {expenses.length} receipts
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono border-slate-200 dark:border-zinc-700 px-1.5 py-0">
            {coaRows.length} accounts
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono border-slate-200 dark:border-zinc-700 px-1.5 py-0">
            {columnsDates.length} dates
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/25 dark:border-emerald-800/60 px-3 py-1 rounded-lg shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              Grand Total
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Matrix Grid Table with Vertical & Horizontal Scroll Freeze */}
      <div className="overflow-auto max-h-[calc(100vh-310px)] relative w-full border-t border-slate-200 dark:border-zinc-800">
        <table className="border-separate border-spacing-0 w-full text-xs caption-bottom">
          <thead className="sticky top-0 z-40 shadow-xs">
            <TableRow className="hover:bg-transparent">
              {/* Sticky Top-Left Corner: CHART OF ACCOUNT */}
              <TableHead className="sticky top-0 left-0 z-50 w-[240px] min-w-[220px] bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 border-b border-r border-slate-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.04)]">
                Chart of Account
              </TableHead>

              {/* Dynamic DATE Columns across the top */}
              {columnsDates.map((dateKey) => (
                <TableHead
                  key={dateKey}
                  className="sticky top-0 z-30 min-w-[130px] max-w-[180px] bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-2.5 py-2 border-b border-r border-slate-200 dark:border-zinc-800 text-right last:border-r-0 shadow-[0_2px_4px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-bold text-foreground">
                      {formatDisplayDate(dateKey)}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {dateColumnTotals.get(dateKey)?.count || 0} receipts
                    </span>
                  </div>
                </TableHead>
              ))}

              {/* Sticky Top-Right: ROW TOTAL (Total per Account) */}
              <TableHead className="sticky top-0 right-0 z-50 w-[120px] min-w-[110px] bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 border-b border-l border-slate-200 dark:border-zinc-800 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-[-2px_2px_4px_rgba(0,0,0,0.04)]">
                Row Total
              </TableHead>
            </TableRow>
          </thead>

          <TableBody>
            {coaRows.map((row) => (
              <TableRow
                key={row.coa.coa_id}
                className="hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 transition-colors group/row"
              >
                {/* Sticky Left: COA Account Info with Truncated GL Code */}
                <TableCell className="sticky left-0 z-20 bg-card dark:bg-zinc-900 backdrop-blur-md px-3.5 py-2.5 border-r border-b border-slate-200 dark:border-zinc-800 font-medium shadow-[2px_0_4px_rgba(0,0,0,0.03)] max-w-[240px]">
                  <div className="space-y-1">
                    <span
                      className="font-semibold text-foreground text-xs block truncate"
                      title={row.coa.account_title}
                    >
                      {row.coa.account_title}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <span
                        className="truncate max-w-[130px] font-medium text-slate-500 dark:text-zinc-400 inline-block"
                        title={row.coa.gl_code || `COA #${row.coa.coa_id}`}
                      >
                        {row.coa.gl_code || `COA #${row.coa.coa_id}`}
                      </span>
                      <span className="shrink-0 text-slate-300 dark:text-zinc-600">•</span>
                      <span className="shrink-0 whitespace-nowrap">{row.receiptCount} receipts</span>
                    </div>
                  </div>
                </TableCell>

                {/* Matrix DATE Data Cells for this COA */}
                {columnsDates.map((dateKey) => {
                  const cell = row.dateCellMap.get(dateKey);

                  if (!cell || cell.items.length === 0) {
                    return (
                      <TableCell
                        key={dateKey}
                        className="px-2.5 py-2.5 border-r border-b border-slate-200/80 dark:border-zinc-800/80 text-right text-slate-300 dark:text-zinc-700 align-middle"
                      >
                        <span className="text-xs font-mono">—</span>
                      </TableCell>
                    );
                  }

                  const hasMultipleItems = cell.items.length > 1;

                  return (
                    <TableCell
                      key={dateKey}
                      className="px-2 py-2 border-r border-b border-slate-200/80 dark:border-zinc-800/80 align-top"
                    >
                      {/* VIEW MODE 1: AMOUNTS ONLY */}
                      {viewMode === "amounts" && (
                        hasMultipleItems ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div
                                role="button"
                                className="flex flex-col items-end gap-1 p-1.5 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors group"
                              >
                                <span className="font-mono font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                                  {formatCurrency(cell.totalAmount)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground font-medium underline decoration-dotted">
                                    {cell.count} receipts
                                  </span>
                                  {cell.hasConcern && (
                                    <span title="Contains item with concern">
                                      <AlertTriangle className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                                    </span>
                                  )}
                                  {cell.hasRejected && (
                                    <span title="Contains rejected item">
                                      <XCircle className="w-3 h-3 text-rose-500 fill-rose-500/20" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-64 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-lg rounded-xl"
                            >
                              <div className="pb-1.5 mb-1.5 border-b border-border/60 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Select Receipt ({cell.items.length})
                                </span>
                                <span className="font-mono font-bold text-xs text-primary">
                                  {formatCurrency(cell.totalAmount)}
                                </span>
                              </div>
                              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                                {cell.items.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => onSelectExpense(item)}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 cursor-pointer text-xs transition-colors group/item"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-1">
                                      <div className="w-7 h-7 rounded border border-border/80 overflow-hidden bg-muted/60 shrink-0 flex items-center justify-center">
                                        {item.receipt_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={getAssetUrl(item.receipt_url)}
                                            alt={item.doc_no}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-mono font-bold text-foreground text-[11px] truncate group-hover/item:text-primary transition-colors">
                                          {item.doc_no}
                                        </p>
                                        <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                          {formatCurrency(Number(item.amount || 0))}
                                        </p>
                                      </div>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-60 group-hover/item:opacity-100 group-hover/item:text-primary shrink-0" />
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            onClick={() => onSelectExpense(cell.items[0])}
                            className="flex flex-col items-end gap-1 p-1.5 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors group"
                          >
                            <span className="font-mono font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                              {formatCurrency(cell.totalAmount)}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground font-medium">
                                1 receipt
                              </span>
                              {cell.hasConcern && (
                                <span title="Contains item with concern">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                                </span>
                              )}
                              {cell.hasRejected && (
                                <span title="Contains rejected item">
                                  <XCircle className="w-3 h-3 text-rose-500 fill-rose-500/20" />
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {/* VIEW MODE 2: RECEIPTS ONLY */}
                      {viewMode === "receipts" && (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {cell.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectExpense(item)}
                              title={`Inspect ${item.doc_no} (${formatCurrency(Number(item.amount || 0))})`}
                              className="relative w-12 h-12 rounded-lg border border-border dark:border-zinc-700 overflow-hidden bg-muted/40 hover:ring-2 hover:ring-primary hover:border-primary transition-all group shrink-0 cursor-pointer"
                            >
                              {item.receipt_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={getAssetUrl(item.receipt_url)}
                                  alt={item.doc_no}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <ImageOff className="w-4 h-4" />
                                </div>
                              )}
                              {item.has_concern && (
                                <div className="absolute top-0.5 right-0.5 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* VIEW MODE 3: RECEIPTS + AMOUNTS */}
                      {viewMode === "both" && (
                        <div className="flex flex-col items-end gap-1.5">
                          {cell.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectExpense(item)}
                              className="flex items-center gap-2 p-1.5 rounded-lg border border-border/80 dark:border-zinc-700/80 bg-muted/30 dark:bg-zinc-800/50 hover:bg-primary/10 hover:border-primary/60 transition-all cursor-pointer w-full text-right justify-between group"
                            >
                              <div className="relative w-9 h-9 rounded-md border border-border dark:border-zinc-700 overflow-hidden bg-muted/60 shrink-0">
                                {item.receipt_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={getAssetUrl(item.receipt_url)}
                                    alt={item.doc_no}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <ImageOff className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex flex-col items-end">
                                <span className="font-mono font-bold text-foreground text-[11px] group-hover:text-primary transition-colors">
                                  {formatCurrency(Number(item.amount || 0))}
                                </span>
                                <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[80px]">
                                  {item.doc_no}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  );
                })}

                {/* Sticky Right: COA Row Total */}
                <TableCell className="sticky right-0 z-20 bg-card dark:bg-zinc-900 backdrop-blur-md px-3.5 py-2.5 border-b border-l border-slate-200 dark:border-zinc-800 text-right font-mono font-bold text-foreground shadow-[-2px_0_4px_rgba(0,0,0,0.03)]">
                  {formatCurrency(row.totalAmount)}
                </TableCell>
              </TableRow>
            ))}

            {/* Bottom Summary Footer Row: Date Totals (Frozen Sticky at Bottom) */}
            <TableRow className="sticky bottom-0 z-30 font-bold bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md border-t-2 border-slate-300 dark:border-zinc-700 shadow-[0_-2px_4px_rgba(0,0,0,0.04)]">
              <TableCell className="sticky bottom-0 left-0 z-40 bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 border-r border-t border-slate-300 dark:border-zinc-700 text-[11px] uppercase tracking-wider text-foreground font-black shadow-[2px_-2px_4px_rgba(0,0,0,0.05)]">
                Daily Totals
              </TableCell>

              {columnsDates.map((dateKey) => {
                const stat = dateColumnTotals.get(dateKey);
                return (
                  <TableCell
                    key={dateKey}
                    className="sticky bottom-0 z-20 bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-2.5 py-2.5 border-r border-t border-slate-300 dark:border-zinc-700 text-right font-mono text-xs text-foreground last:border-r-0 shadow-[0_-2px_4px_rgba(0,0,0,0.03)]"
                  >
                    {stat && stat.totalAmount > 0 ? (
                      <span className="font-bold text-foreground">{formatCurrency(stat.totalAmount)}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-600 font-normal">—</span>
                    )}
                  </TableCell>
                );
              })}

              <TableCell className="sticky bottom-0 right-0 z-40 bg-slate-100/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 border-l border-t border-slate-300 dark:border-zinc-700 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs shadow-[-2px_-2px_4px_rgba(0,0,0,0.05)]">
                {formatCurrency(grandTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </table>
      </div>
    </div>
  );
};
