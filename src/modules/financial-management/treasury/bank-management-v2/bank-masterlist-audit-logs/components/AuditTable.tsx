"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";

import { phtDisplayStamp, shiftWallClock } from "../pht";
import type { AuditLogRow } from "../types";
import { TablePager } from "./TablePager";

type Props = {
  rows: AuditLogRow[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Filter band rendered inside the card, above the table. */
  filters?: ReactNode;
  emptyLabel?: string;
};

const COLUMNS = 5;

/** FSD 1.6 movement log: every recorded action, stamped in PHT, with UTC imports flagged. */
export function AuditTable({ rows, page, pageCount, total, pageSize, onPage, onPageSizeChange, filters, emptyLabel }: Props) {
  return (
    <Card className="overflow-hidden border-border/50 border-t-[3px] border-t-rose-500/70 shadow-none">
      <CardContent className="p-0">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Movement log</h2>
            <p className="text-xs text-muted-foreground">Every recorded action, stamped in PHT. UTC imports are flagged.</p>
          </div>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatNumber(total)} entries
          </Badge>
        </header>
        {filters}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Recorded (PHT)</TableHead>
                <TableHead className="w-[160px]">Module</TableHead>
                <TableHead className="w-[200px]">Action</TableHead>
                <TableHead className="w-[160px]">Reference</TableHead>
                <TableHead className="w-[140px]">User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                    {emptyLabel ?? "The movement log has no entry yet."}
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => {
                const stored = row.legacyUtcAt ?? row.occurredAt;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px]">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs tabular-nums" title={stored}>
                          {phtDisplayStamp(row.occurredAt)}
                        </span>
                        {row.legacyUtcAt ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-red-200 bg-red-50 text-[11px] font-semibold text-red-700"
                            title="Imported with a UTC wall clock, so the stored hour is 8 hours behind PHT."
                          >
                            UTC import
                          </Badge>
                        ) : null}
                      </span>
                      {row.legacyUtcAt ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          PHT {shiftWallClock(row.legacyUtcAt, 8) || "—"}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={row.module}>
                      {row.module}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate" title={row.action}>
                        {row.action}
                      </p>
                      {row.detail ? (
                        <p className="truncate text-xs text-muted-foreground" title={row.detail}>
                          {row.detail}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate" title={row.reference ?? undefined}>
                      {row.reference ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate" title={row.actorName ?? undefined}>
                      {row.actorName ?? "System"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <TablePager
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageChange={onPage}
          onPageSizeChange={onPageSizeChange}
          className="border-t px-4 py-3"
        />
      </CardContent>
    </Card>
  );
}
