"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
};

const COLUMNS = 4;

/** The prototype folds the finding's reference and date under its detail, so no column is spent on them. */
function findingMeta(finding: ArfFinding): string {
  return [finding.reference, finding.occurredAt ? toPhtDateString(finding.occurredAt) : null]
    .filter(Boolean)
    .join(" · ");
}

/** FSD 1.6 ARF findings: one row per detected audit finding, worst first. */
export function ArfTable({ findings, page, pageCount, total, onPageChange }: Props) {
  const start = (page - 1) * LIST_PAGE_SIZE;
  const rows = findings.slice(start, start + LIST_PAGE_SIZE);

  return (
    <Card className="overflow-hidden border-border/50 shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Severity</TableHead>
                <TableHead className="w-[180px]">ARF sub-module</TableHead>
                <TableHead className="min-w-[240px]">Finding</TableHead>
                <TableHead className="min-w-[320px]">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                    No audit finding was detected.
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
          shown={rows.length}
          onPageChange={onPageChange}
          className="border-t px-4 py-3"
        />
      </CardContent>
    </Card>
  );
}
