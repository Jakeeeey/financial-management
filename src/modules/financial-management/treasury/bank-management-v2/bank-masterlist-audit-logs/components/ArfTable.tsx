"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";

import { LIST_PAGE_SIZE, statusTone, toneClass } from "../constants";
import { toPhtDateString } from "../pht";
import type { ArfFinding } from "../types";
import { TablePager } from "./TablePager";

type Props = {
  findings: ArfFinding[];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Filter band rendered inside the card, above the table. */
  filters?: ReactNode;
  onOpenModule?: (path: string) => void;
};

const COLUMNS = 5;

const MODULE_LABEL: Record<string, string> = {
  "bank-deposit": "Open Bank Deposit",
  "check-clearing-management": "Open Check & Clearing",
};

/** The prototype folds the finding's reference and date under its detail, so no column is spent on them. */
function findingMeta(finding: ArfFinding): string {
  return [finding.reference, finding.occurredAt ? toPhtDateString(finding.occurredAt) : null]
    .filter(Boolean)
    .join(" · ");
}

/** FSD 1.6 ARF findings: one row per detected audit finding, worst first. */
export function ArfTable({
  findings,
  page,
  pageCount,
  total,
  onPageChange,
  filters,
  onOpenModule,
}: Props) {
  const start = (page - 1) * LIST_PAGE_SIZE;
  const rows = findings.slice(start, start + LIST_PAGE_SIZE);

  return (
    <Card className="overflow-hidden border-border/50 border-t-[3px] border-t-rose-500/70 shadow-none">
      <CardContent className="p-0">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">ARF findings</h2>
            <p className="text-xs text-muted-foreground">Worst first. Every finding names the module that resolves it.</p>
          </div>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatNumber(total)} findings
          </Badge>
        </header>
        {filters}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Severity</TableHead>
                <TableHead className="w-[180px]">ARF sub-module</TableHead>
                <TableHead className="min-w-[240px]">Finding</TableHead>
                <TableHead className="min-w-[320px]">Detail</TableHead>
                <TableHead className="w-[190px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                    No audit finding matches these filters.
                  </TableCell>
                </TableRow>
              )}

              {rows.map((finding) => {
                const meta = findingMeta(finding);
                return (
                  <TableRow key={finding.key}>
                    <TableCell>
                      <Badge variant="outline" className={toneClass(statusTone(finding.severity))}>
                        {finding.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={finding.subModule}>
                      {finding.subModule}
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate font-medium" title={finding.title}>
                      {finding.title}
                    </TableCell>
                    <TableCell className="max-w-[480px]">
                      <p className="line-clamp-2" title={finding.detail}>
                        {finding.detail}
                      </p>
                      {meta ? (
                        <p className="truncate text-xs text-muted-foreground" title={meta}>
                          {meta}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {finding.goTo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenModule?.(`/fm/treasury/bank-management-v2/${finding.goTo}`)}
                        >
                          {MODULE_LABEL[finding.goTo] ?? "Open module"}
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No action</span>
                      )}
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
          pageSize={LIST_PAGE_SIZE}
          onPageChange={onPageChange}
          className="border-t px-4 py-3"
        />
      </CardContent>
    </Card>
  );
}
