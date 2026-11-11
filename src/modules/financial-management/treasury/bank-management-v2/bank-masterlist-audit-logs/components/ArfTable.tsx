"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";

import { statusTone, toneClass } from "../constants";
import { toPhtDateString } from "../pht";
import type { ArfFinding } from "../types";
import { ArfFindingDialog } from "./ArfFindingDialog";
import { TablePager, pageSlice } from "./TablePager";

type Props = {
  findings: ArfFinding[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Filter band rendered inside the card, above the table. */
  filters?: ReactNode;
};

const COLUMNS = 5;

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
  pageSize,
  onPageChange,
  onPageSizeChange,
  filters,
}: Props) {
  const rows = pageSlice(findings, page, pageSize);
  const [selected, setSelected] = useState<ArfFinding | null>(null);

  return (
    <Card className="overflow-hidden border-border/50 border-t-[3px] border-t-rose-500/70 shadow-none">
      <CardContent className="p-0">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">ARF findings</h2>
            <p className="text-xs text-muted-foreground">
              Worst first. Every finding names the module that resolves it.
            </p>
          </div>
          <Badge
            variant="outline"
            className="tabular-nums text-[11px]"
            title="Live count from a fresh scan. Earlier scan entries in Movement Logs record the counts at the time they ran."
          >
            {formatNumber(total)} findings
          </Badge>
        </header>
        {filters}
        <div className="hidden overflow-x-auto xl:block">
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
                  <TableRow
                    key={finding.key}
                    tabIndex={0}
                    aria-label={`View details for ${finding.title}`}
                    className="cursor-pointer"
                    onClick={() => setSelected(finding)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(finding);
                      }
                    }}
                  >
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
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(finding);
                        }}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <ul className="divide-y divide-border xl:hidden">
          {findings.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No audit finding matches these filters.</li>
          )}
          {rows.map((finding) => {
            const meta = findingMeta(finding);
            return (
              <li key={finding.key} className="space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-medium">{finding.title}</p>
                  <Badge variant="outline" className={toneClass(statusTone(finding.severity))}>
                    {finding.severity}
                  </Badge>
                </div>
                <p className="break-words text-xs text-muted-foreground">{finding.subModule}</p>
                <p className="break-words text-sm">{finding.detail}</p>
                {finding.account ? <p className="break-words text-xs text-muted-foreground">{finding.account}</p> : null}
                {meta ? <p className="break-words text-xs text-muted-foreground">{meta}</p> : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="-ml-2"
                  onClick={() => setSelected(finding)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View details
                </Button>
              </li>
            );
          })}
        </ul>

        <TablePager
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          className="border-t px-4 py-3"
        />

        <ArfFindingDialog finding={selected} onOpenChange={(open) => !open && setSelected(null)} />
      </CardContent>
    </Card>
  );
}
