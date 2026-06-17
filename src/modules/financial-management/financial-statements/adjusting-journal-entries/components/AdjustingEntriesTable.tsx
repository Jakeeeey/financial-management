"use client";

import { Eye, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { AdjustingEntry } from "../types";
import { formatDate, money, statusBadgeClass } from "./formatters";
import type { EntryAction, SortDirection, SortKey } from "./types";
import { SortableHead } from "./SortableHead";
import { TooltipIconButton } from "./TooltipIconButton";

type AdjustingEntriesTableProps = {
  entries: AdjustingEntry[];
  isLoading: boolean;
  actionId: number | null;
  sortKey: SortKey;
  sortDirection: SortDirection;
  entryCombinedVariance: Record<number, number>;
  onSort: (column: SortKey) => void;
  onCreate: () => void;
  onOpenEntry: (entry: AdjustingEntry, viewOnly: boolean) => void;
  onRequestAction: (entry: AdjustingEntry, action: EntryAction) => void;
};

export function AdjustingEntriesTable({
  entries,
  isLoading,
  actionId,
  sortKey,
  sortDirection,
  entryCombinedVariance,
  onSort,
  onCreate,
  onOpenEntry,
  onRequestAction,
}: AdjustingEntriesTableProps) {
  return (
    <div className="rounded-md border bg-background shadow-sm">
      <div className="w-full overflow-hidden">
        <Table className="table-fixed text-xs xl:text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <SortableHead
                column="jeNo"
                activeColumn={sortKey}
                direction={sortDirection}
                className="w-[9%]"
                onSort={onSort}
              >
                JE No.
              </SortableHead>
              <SortableHead
                column="transactionDate"
                activeColumn={sortKey}
                direction={sortDirection}
                className="w-[10%]"
                onSort={onSort}
              >
                Date
              </SortableHead>
              <TableHead className="w-[22%]">Description</TableHead>
              <SortableHead
                column="status"
                activeColumn={sortKey}
                direction={sortDirection}
                className="w-[9%]"
                onSort={onSort}
              >
                Status
              </SortableHead>
              <TableHead className="w-[13%]">Cost Center</TableHead>
              <TableHead className="w-[9%] text-right">Debit</TableHead>
              <TableHead className="w-[9%] text-right">Credit</TableHead>
              <TableHead className="w-[9%] text-right">Variance</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                  Loading entries
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <span>No adjusting entries found</span>
                    <Button type="button" size="sm" onClick={onCreate}>
                      <Plus className="mr-2 size-4" />
                      New Adjusting Entry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const actionBusy = actionId === entry.id;
                const entryVariance = entryCombinedVariance[entry.id] ?? entry.combinedVariance ?? entry.variance;
                const canPost = entry.status === "Draft";
                const postTooltip = canPost
                  ? "Post to ledger"
                  : entry.status !== "Draft"
                    ? "Only draft entries can be posted"
                    : "Post unavailable";

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-normal wrap-break-word font-mono text-xs font-medium">
                      {entry.jeNo || `AJE-${entry.id}`}
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs">{formatDate(entry.transactionDate)}</TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="line-clamp-2 min-w-0 font-medium">{entry.description}</div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-left">{entry.description}</TooltipContent>
                      </Tooltip>
                      <div className="truncate text-xs text-muted-foreground">{entry.creatorName || "Unknown creator"}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge variant="outline" className={statusBadgeClass(entry.status)}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal">
                      <div className="truncate text-sm">{entry.divisionName || "-"}</div>
                      <div className="truncate text-xs text-muted-foreground">{entry.departmentName || "-"}</div>
                    </TableCell>
                    <TableCell className="break-all text-right font-mono text-[11px] xl:text-xs">{money(entry.totalDebit)}</TableCell>
                    <TableCell className="break-all text-right font-mono text-[11px] xl:text-xs">{money(entry.totalCredit)}</TableCell>
                    <TableCell className={cn("break-all text-right font-mono text-[11px] xl:text-xs", Math.abs(entryVariance) >= 0.005 && "text-destructive")}>
                      {money(entryVariance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-0.5">
                        <TooltipIconButton
                          label={`View ${entry.jeNo || "adjusting entry"}`}
                          tooltip="View entry"
                          className="size-7"
                          onClick={() => onOpenEntry(entry, true)}
                        >
                          <Eye className="size-3.5" />
                        </TooltipIconButton>
                        <TooltipIconButton
                          label={`Edit ${entry.jeNo || "adjusting entry"}`}
                          tooltip={entry.status === "Draft" ? "Edit draft" : "Posted and voided entries are read-only"}
                          className="size-7"
                          onClick={() => onOpenEntry(entry, false)}
                          disabled={entry.status !== "Draft"}
                        >
                          <Pencil className="size-3.5" />
                        </TooltipIconButton>
                        <TooltipIconButton
                          label={`Post ${entry.jeNo || "adjusting entry"}`}
                          tooltip={postTooltip}
                          className="size-7"
                          onClick={() => onRequestAction(entry, "post")}
                          disabled={!canPost || actionBusy}
                        >
                          {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        </TooltipIconButton>
                        <TooltipIconButton
                          label={`Delete ${entry.jeNo || "adjusting entry"}`}
                          tooltip={entry.status === "Draft" ? "Delete draft" : "Only drafts can be deleted"}
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => onRequestAction(entry, "delete")}
                          disabled={entry.status !== "Draft" || actionBusy}
                        >
                          <Trash2 className="size-3.5" />
                        </TooltipIconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
