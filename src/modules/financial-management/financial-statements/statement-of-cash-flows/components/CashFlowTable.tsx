"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
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
import {
  ArrowUpDown,
  Search,
  FileText,
  Download,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CashFlowEntry, GroupedCashFlowEntries } from "../types/cash-flow.schema";

interface CashFlowTableProps {
  groupedEntries: GroupedCashFlowEntries;
  isLoading?: boolean;
}

type SortField = "transactionDate" | "netCashFlow" | "cashFlowActivity";
type SortOrder = "asc" | "desc";

// ── Memoized Intl formatters (created once) ───────────────────────
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// ── Memoized helper lookups ──────────────────────────────────────
const BADGE_VARIANT_MAP: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  operating: "default",
  investing: "secondary",
  financing: "outline",
};

function getActivityBadgeVariant(activity: string | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  if (!activity) return "outline";
  return BADGE_VARIANT_MAP[activity.toLowerCase()] ?? "outline";
}

// ── Row component (pure, memoized) ───────────────────────────────
interface TableRowProps {
  entry: CashFlowEntry;
  index: number;
}
const CashFlowTableRow = React.memo(function CashFlowTableRow({ entry }: TableRowProps) {
  const dateStr = entry.transactionDate
    ? dateFormatter.format(new Date(entry.transactionDate))
    : "—";

  const ref = entry.transactionRef || "—";
  const activity = entry.cashFlowActivity || "N/A";
  const netCashFlow = entry.netCashFlow ?? 0;
  const amount = currencyFormatter.format(netCashFlow);

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
          <span>{dateStr}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getActivityBadgeVariant(entry.cashFlowActivity)}>
          {activity}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
        {ref}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-medium tabular-nums",
          netCashFlow >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        )}
      >
        {amount}
      </TableCell>
    </TableRow>
  );
});

// ── Skeleton row ─────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell><div className="h-4 w-24 bg-muted rounded" /></TableCell>
      <TableCell><div className="h-6 w-32 bg-muted rounded" /></TableCell>
      <TableCell><div className="h-4 w-40 bg-muted rounded" /></TableCell>
      <TableCell className="text-right"><div className="h-4 w-24 bg-muted rounded ml-auto" /></TableCell>
    </TableRow>
  );
}

// ── Main component ───────────────────────────────────────────────
export function CashFlowTable({ groupedEntries, isLoading }: CashFlowTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("transactionDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // ── Debounced search (avoids re-render on every keystroke) ──────
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim().toLowerCase());
    }, 300);
  }, []);

  // ── Memoized filtered / sorted entries ──────────────────────────
  const allEntries = useMemo(() => {
    const entries = [
      ...groupedEntries.operating,
      ...groupedEntries.investing,
      ...groupedEntries.financing,
      ...groupedEntries.other,
    ];

    // Search filter (uses debounced query)
    let filtered = entries;
    if (debouncedQuery) {
      filtered = entries.filter(
        (entry) =>
          entry.transactionRef?.toLowerCase().includes(debouncedQuery) ||
          entry.cashFlowActivity?.toLowerCase().includes(debouncedQuery)
      );
    }

    // Activity filter
    if (activityFilter !== "all") {
      const lowerFilter = activityFilter.toLowerCase();
      filtered = filtered.filter(
        (entry) => entry.cashFlowActivity?.toLowerCase().includes(lowerFilter)
      );
    }

    // Sort
    const a = sortOrder === "asc" ? -1 : 1;
    const b = sortOrder === "asc" ? 1 : -1;

    filtered.sort((x, y) => {
      let xv: number | string = "";
      let yv: number | string = "";

      switch (sortField) {
        case "transactionDate":
          xv = x.transactionDate ? new Date(x.transactionDate).getTime() : 0;
          yv = y.transactionDate ? new Date(y.transactionDate).getTime() : 0;
          break;
        case "netCashFlow":
          xv = x.netCashFlow ?? 0;
          yv = y.netCashFlow ?? 0;
          break;
        case "cashFlowActivity":
          xv = x.cashFlowActivity ?? "";
          yv = y.cashFlowActivity ?? "";
          break;
      }

      if (xv < yv) return a;
      if (xv > yv) return b;
      return 0;
    });

    return filtered;
  }, [groupedEntries, debouncedQuery, sortField, sortOrder, activityFilter]);

  // ── Sort handlers (stable callbacks) ────────────────────────────
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortOrder("desc");
      return field;
    });
  }, []);

  const getSortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) return null;
      return (
        <ArrowUpDown
          className={cn("ml-2 h-4 w-4", sortOrder === "asc" ? "text-emerald-500" : "")}
        />
      );
    },
    [sortField, sortOrder]
  );

  // ── Loading state ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by reference or activity..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="operating">Operating</SelectItem>
              <SelectItem value="investing">Investing</SelectItem>
              <SelectItem value="financing">Financing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground tabular-nums">
        Showing {allEntries.length} transaction{allEntries.length !== 1 ? "s" : ""}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors w-[180px]"
                onClick={() => handleSort("transactionDate")}
              >
                <div className="flex items-center">
                  Date
                  {getSortIcon("transactionDate")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("cashFlowActivity")}
              >
                <div className="flex items-center">
                  Activity Type
                  {getSortIcon("cashFlowActivity")}
                </div>
              </TableHead>
              <TableHead className="max-w-[200px]">Reference</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("netCashFlow")}
              >
                <div className="flex items-center justify-end">
                  Net Cash Flow
                  {getSortIcon("netCashFlow")}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                    <p>No cash flow transactions found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              allEntries.map((entry, index) => (
                <CashFlowTableRow key={`${entry.transactionRef}-${index}`} entry={entry} index={index} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}