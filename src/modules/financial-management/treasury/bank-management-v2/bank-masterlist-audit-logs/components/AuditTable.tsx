"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { phtDisplayStamp } from "../pht";
import type { AuditLogRow } from "../types";

type Props = {
  rows: AuditLogRow[];
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
};

const COLUMNS = 6;

/** FSD 1.6 movement log: every recorded action, stamped in PHT, with UTC imports flagged. */
export function AuditTable({ rows, page, pageCount, total, onPage }: Props) {
  return (
    <Card className="overflow-hidden border-border/50 shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Stored timestamp</TableHead>
                <TableHead className="w-[170px]">PHT reading</TableHead>
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
                    The movement log has no entry yet.
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => {
                const stored = row.legacyUtcAt ?? row.occurredAt;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[200px]">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs" title={stored}>
                          {stored}
                        </span>
                        {row.legacyUtcAt ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-red-200 bg-red-50 text-[11px] font-semibold text-red-700"
                          >
                            UTC
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[170px] truncate font-mono text-xs tabular-nums">
                      {phtDisplayStamp(row.occurredAt)}
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

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {page} of {pageCount} · {total} entries
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
