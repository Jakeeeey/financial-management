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

import type { FinalHeaderGroup } from "../type";
import { formatCurrency, formatDate } from "../utils/format";

type Props = {
  groups: FinalHeaderGroup[];
  loading: boolean;
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
};

function uniqueStatuses(group: ApprovalAwareGroup) {
  return [...new Set((group.draft_statuses ?? []).filter(Boolean))];
}

function formatStatusText(group: ApprovalAwareGroup) {
  const statuses = uniqueStatuses(group);
  return statuses.length > 0 ? statuses.join(", ") : "No draft status";
}

function getApprovalTierText(group: ApprovalAwareGroup) {
  const current = group.current_tier ? `L${group.current_tier}` : "Pending";
  const required = group.required_approver_level ? `L${group.required_approver_level}` : "Final";
  return `${current} / ${required}`;
}

function ApprovalStateBadge({ group }: { group: ApprovalAwareGroup }) {
  if (group.can_act) {
    return (
      <Badge className="w-fit rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-50">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ready for Action
      </Badge>
    );
  }

  return (
    <Badge className="w-fit rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-50">
      <Clock3 className="mr-1 h-3 w-3" />
      Waiting Approval Tier
    </Badge>
  );
}

export default function FinalHeaderGroupsTable({
  groups,
  loading,
  onOpenTopSheet,
  onRefresh,
}: Props) {
  const [query, setQuery] = React.useState("");

  const filteredGroups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;

    return groups.filter((group) => {
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
  }, [groups, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-white to-slate-50/50 px-5 py-3 shadow-md md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h3 className="text-base font-black tracking-tight text-slate-800 leading-none">Available Top Sheets</h3>
          <p className="text-[10px] font-medium text-muted-foreground">Select a period group to review the aggregated matrix.</p>
        </div>
        
        <div className="flex flex-1 flex-col gap-2 md:max-w-xl md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/50" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups..."
              className="h-9 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-sm transition-all focus:ring-2 focus:ring-primary/5"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-slate-200 bg-white px-4 text-xs font-bold shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30">
        <div className="h-full overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[110px]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-xl">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Ref</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Coverage Period</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Context</TableHead>
                <TableHead className="text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Metrics</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Aggregate Total</TableHead>
                <TableHead className="text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 px-4 py-2.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                        <Layers3 className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Assembling Groups...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                      <div className="rounded-3xl bg-slate-50 p-8">
                        <FolderOpen className="h-16 w-16 text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-black text-slate-800">No Groups Found</p>
                        <p className="text-sm font-medium text-muted-foreground">Adjust your search or sync to refresh data.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group, index) => (
                  <TableRow key={group.group_key} className="group transition-colors hover:bg-slate-50/50">
                    <TableCell className="text-center px-2 py-3">
                      <span className="text-[9px] font-black tabular-nums text-slate-300">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <CalendarRange className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-800">{formatPeriod(group)}</p>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                            Key: {group.group_key}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="secondary" className="w-fit rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600 border border-slate-200/50">
                          {group.division_name ?? `Division #${group.division_id}`}
                        </Badge>
                        <ApprovalStateBadge group={group as ApprovalAwareGroup} />
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Approval Tier: <span className="text-slate-700">{getApprovalTierText(group as ApprovalAwareGroup)}</span>
                          </p>
                          <p className="text-[9px] font-semibold text-slate-500">
                            Status: {formatStatusText(group as ApprovalAwareGroup)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <div className="flex flex-col items-center gap-0.5 px-2 border-r border-slate-100 last:border-0" title="Salesmen">
                          <span className="text-[11px] font-black text-slate-800">{group.salesman_count}</span>
                          <span className="text-[7px] font-black uppercase tracking-tighter text-muted-foreground">Users</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 px-2 border-r border-slate-100 last:border-0" title="COA">
                          <span className="text-[11px] font-black text-slate-800">{group.coa_count}</span>
                          <span className="text-[7px] font-black uppercase tracking-tighter text-muted-foreground">COA</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 px-2 border-r border-slate-100 last:border-0" title="Lines">
                          <span className="text-[11px] font-black text-slate-800">{group.expense_count}</span>
                          <span className="text-[7px] font-black uppercase tracking-tighter text-muted-foreground">Lines</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-4 py-3">
                      <p className="text-[13px] font-black tabular-nums text-emerald-600">
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
    </div>
  );
}
