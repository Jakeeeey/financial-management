// src/modules/financial-management/treasury/bulk-approval/components/FinalHeaderGroupsTable.tsx
"use client";

import * as React from "react";
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  Eye,
  FolderOpen,
  Layers3,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ChevronRight,
  XCircle,
  Check,
  ChevronsUpDown,
  AlertTriangle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { FinalHeaderGroup } from "../type";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

type Props = {
  groups: FinalHeaderGroup[];
  loading: boolean;
  statusFilter?: "ready" | "completed" | "all";
  onStatusFilterChange?: (status: "ready" | "completed" | "all") => void;
  onOpenTopSheet: (group: FinalHeaderGroup) => void;
  onRefresh: () => void;
};

function formatPeriod(group: FinalHeaderGroup) {
  return `${formatDate(group.period_from)} - ${formatDate(group.period_to)}`;
}

type ApprovalAwareGroup = FinalHeaderGroup & {
  draft_statuses?: string[];
  can_act?: boolean;
  is_waiting?: boolean;
  current_tier?: number;
  required_approver_level?: number;
  is_completed?: boolean;
  has_concern?: boolean;
};

function uniqueStatuses(group: ApprovalAwareGroup) {
  return [...new Set((group.draft_statuses ?? []).filter(Boolean))];
}

function formatStatusText(group: ApprovalAwareGroup) {
  const statuses = uniqueStatuses(group);
  return statuses.length > 0 ? statuses.map(s => s.replace(/Pending_L\d+/gi, "Pending Review").replace(/_/g, " ")).join(", ") : "No draft status";
}

function getApprovalTierText(group: ApprovalAwareGroup) {
  const current = group.current_tier ? `Level ${group.current_tier}` : "Pending";
  const required = group.required_approver_level ? `Level ${group.required_approver_level}` : "Final";
  return `${current} of ${required}`;
}

function ApprovalStateBadge({ group }: { group: ApprovalAwareGroup }) {
  const isApproved = Boolean(group.is_completed);

  if (isApproved) {
    const statuses = group.draft_statuses ?? [];
    const allRejected = statuses.length > 0 && statuses.every((s) => s.toLowerCase() === "rejected");

    if (allRejected) {
      return (
        <Badge className="w-fit rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-500/10 dark:bg-rose-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 hover:bg-rose-500/15 dark:hover:bg-rose-900/40">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    }

    return (
      <Badge className="w-fit rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 dark:bg-emerald-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 dark:hover:bg-emerald-900/40">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Posted / Completed
      </Badge>
    );
  }

  if (group.can_act) {
    return (
      <Badge className="w-fit rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ready for Approval
      </Badge>
    );
  }

  return (
    <Badge className="w-fit rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/40">
      <Clock3 className="mr-1 h-3 w-3" />
      Waiting Approval Tier
    </Badge>
  );
}

type SortField = "period" | "division" | "amount" | "status";
type SortOrder = "asc" | "desc";

export default function FinalHeaderGroupsTable({
  groups,
  loading,
  statusFilter,
  onStatusFilterChange,
  onOpenTopSheet,
  onRefresh,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("period");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [page, setPage] = React.useState(1);
  const [selectedSalesmanId, setSelectedSalesmanId] = React.useState<string>("all");
  const [open, setOpen] = React.useState(false);
  const pageSize = 8;

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, query, selectedSalesmanId]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function renderSortIndicator(field: SortField) {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary shrink-0" />
    );
  }

  const uniqueSalesmen = React.useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((g) => {
      if (g.creator_id) {
        map.set(g.creator_id, g.creator_name || "Unknown Creator");
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  const filteredGroups = React.useMemo(() => {
    let result = groups;

    if (selectedSalesmanId !== "all") {
      result = result.filter((g) => g.creator_id === Number(selectedSalesmanId));
    }

    const q = query.trim().toLowerCase();
    if (!q) return result;

    return result.filter((group) => {
      const haystack = [
        group.division_name ?? "",
        formatStatusText(group as ApprovalAwareGroup),
        getApprovalTierText(group as ApprovalAwareGroup),
        group.period_from,
        group.period_to,
        String(group.header_count),
        String(group.total_amount),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [groups, query, selectedSalesmanId]);

  const sortedGroups = React.useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "period":
          valA = a.period_from;
          valB = b.period_from;
          break;
        case "division":
          valA = a.division_name ?? "";
          valB = b.division_name ?? "";
          break;
        case "amount":
          valA = a.total_amount;
          valB = b.total_amount;
          break;
        case "status":
          valA = (a as ApprovalAwareGroup).is_completed ? 0 : (a as ApprovalAwareGroup).can_act ? 2 : 1;
          valB = (b as ApprovalAwareGroup).is_completed ? 0 : (b as ApprovalAwareGroup).can_act ? 2 : 1;
          break;
      }

      if (valA === valB) {
        const orderModifier = sortOrder === "asc" ? 1 : -1;
        if (sortField !== "division") {
          const divCompare = String(a.division_name ?? "").localeCompare(String(b.division_name ?? ""));
          if (divCompare !== 0) return divCompare * orderModifier;
        }
        return String(a.group_key).localeCompare(String(b.group_key));
      }
      const orderModifier = sortOrder === "asc" ? 1 : -1;
      if (typeof valA === "string" && typeof valB === "string") {
        return valA.localeCompare(valB) * orderModifier;
      }
      return ((valA as number) < (valB as number) ? -1 : 1) * orderModifier;
    });
  }, [filteredGroups, sortField, sortOrder]);

  const totalItems = sortedGroups.length;
  const pageCount = Math.ceil(totalItems / pageSize) || 1;

  const paginatedGroups = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedGroups.slice(start, start + pageSize);
  }, [sortedGroups, page]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-3 rounded-2xl border dark:border-slate-800 bg-gradient-to-br from-white dark:from-slate-900 to-slate-50/50 dark:to-slate-900/50 px-5 py-3 shadow-md dark:shadow-none md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h3 className="text-base font-black tracking-tight text-slate-800 dark:text-slate-200 leading-none">Available Top Sheets</h3>
          <p className="text-[10px] font-medium text-muted-foreground">Select a period group to review the aggregated matrix.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 flex-1 md:max-w-3xl md:justify-end">
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border dark:border-slate-800">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "all" ? "secondary" : "ghost"}
              className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              onClick={() => onStatusFilterChange?.("all")}
              disabled={loading}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "ready" ? "secondary" : "ghost"}
              className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFilter === "ready" 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              onClick={() => onStatusFilterChange?.("ready")}
              disabled={loading}
            >
              Ready for Approval
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "completed" ? "secondary" : "ghost"}
              className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFilter === "completed" 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
              onClick={() => onStatusFilterChange?.("completed")}
              disabled={loading}
            >
              Completed / Posted
            </Button>
          </div>

          <div className="flex items-center">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-8 w-40 justify-between rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium shadow-sm transition-all focus:ring-2 focus:ring-primary/5 px-3 font-normal text-slate-700 dark:text-slate-200"
                  disabled={loading || uniqueSalesmen.length === 0}
                >
                  <span className="truncate">
                    {selectedSalesmanId === "all"
                      ? "All Salesmen"
                      : uniqueSalesmen.find((s) => s.id.toString() === selectedSalesmanId)?.name || "All Salesmen"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
                <Command>
                  <CommandInput placeholder="Search salesman..." className="h-9 text-xs" />
                  <CommandList className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
                    <CommandEmpty className="py-2 text-center text-xs">No salesman found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="All Salesmen"
                        onSelect={() => {
                          setSelectedSalesmanId("all");
                          setOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={`mr-2 h-3.5 w-3.5 ${
                            selectedSalesmanId === "all" ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        All Salesmen
                      </CommandItem>
                      {uniqueSalesmen.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setSelectedSalesmanId(s.id.toString());
                            setOpen(false);
                          }}
                          className="text-xs"
                        >
                          <Check
                            className={`mr-2 h-3.5 w-3.5 ${
                              selectedSalesmanId === s.id.toString() ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/50" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups..."
              className="h-8 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 text-xs font-medium shadow-sm dark:shadow-none transition-all focus:ring-2 focus:ring-primary/5"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-bold shadow-sm dark:shadow-none transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 shrink-0"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 text-primary ${loading ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl dark:shadow-none">
        <div className="h-full overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[38%]" />
              <col className="w-[26%]" />
              <col className="w-[18%]" />
              <col className="w-[110px]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 w-[50px]">Ref</TableHead>
                <TableHead 
                  className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort("period")}
                >
                  <span className="flex items-center gap-1">
                    Salesman / Period
                    {renderSortIndicator("period")}
                  </span>
                </TableHead>
                <TableHead 
                  className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort("division")}
                >
                  <span className="flex items-center gap-1">
                    Context
                    {renderSortIndicator("division")}
                  </span>
                </TableHead>
                <TableHead 
                  className="text-right text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort("amount")}
                >
                  <span className="flex items-center justify-end gap-1">
                    Aggregate Total
                    {renderSortIndicator("amount")}
                  </span>
                </TableHead>
                <TableHead className="text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                        <Layers3 className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Assembling Groups...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-8">
                        <FolderOpen className="h-16 w-16 text-slate-200 dark:text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-black text-slate-800 dark:text-slate-200">No Groups Found</p>
                        <p className="text-sm font-medium text-muted-foreground">Adjust your search or sync to refresh data.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedGroups.map((group, index) => (
                  <TableRow key={group.group_key} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <TableCell className="text-center px-2 py-3">
                      <span className="text-[9px] font-black tabular-nums text-slate-300">
                        {((page - 1) * pageSize + index + 1).toString().padStart(2, '0')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <CalendarRange className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">
                            {group.creator_name || "Unknown Creator"}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatPeriod(group)}
                          </p>
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                            Submitted: {group.date_submitted ? formatDateTime(group.date_submitted) : "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="w-fit rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                            {group.division_name ?? `Division #${group.division_id}`}
                          </Badge>
                          <ApprovalStateBadge group={group as ApprovalAwareGroup} />
                          {group.has_concern && (
                            <Badge className="w-fit rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-500/10 dark:bg-amber-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 dark:hover:bg-amber-900/40 gap-1 flex items-center">
                              <AlertTriangle size={10} className="text-amber-600 dark:text-amber-500 animate-pulse" />
                              <span>With Concern</span>
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Approval Tier: <span className="text-slate-700 dark:text-slate-300">{getApprovalTierText(group as ApprovalAwareGroup)}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-4 py-3">
                      <p className="text-[13px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(group.total_amount)}
                      </p>
                      <p className="text-[8px] font-bold text-muted-foreground italic mt-0.5 leading-none">
                        {group.header_count} headers
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-xl bg-primary px-3 font-black uppercase tracking-widest text-[9px] shadow-md transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
                          onClick={() => onOpenTopSheet(group)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {(group as ApprovalAwareGroup).can_act ? "Review" : "View"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0 border-t pt-2">
        <p className="text-[11px] text-muted-foreground">
          Showing <span className="font-bold text-foreground">{paginatedGroups.length}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems}</span> groups
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(page - 1)} disabled={page <= 1}>
             <ArrowLeft className="h-3 w-3" />
          </Button>
          <span className="text-[11px] font-bold">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
             <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
