"use client";

import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import type { WorksheetLine } from "../types";

const SECTION_LABEL: Record<WorksheetLine["section"], string> = {
  INCOME: "Part II · Income",
  DEDUCTIONS: "Part III · Deductions",
  TAX: "Part IV · Tax and credits",
};

interface Props {
  lines: WorksheetLine[];
  total: number;
}

/**
 * The 1702Q worksheet: one row per numbered line, one column per quarter, plus the year.
 * Every row already states how it is built, so there is nothing to drill into.
 */
export function WorksheetTable({ lines, total }: Props) {
  // Group sales, group cost of sales, other income, non-deductible expenses and NOLCO sit at zero on a
  // clean year; five guaranteed-empty rows push the lines that matter off the fold.
  const visible = lines.filter((line) => line.emphasis || line.values.some((value) => Math.abs(value) >= 0.005) || Math.abs(line.yearValue) >= 0.005);
  const hidden = lines.length - visible.length;
  const sections = (Object.keys(SECTION_LABEL) as WorksheetLine["section"][]).filter((section) =>
    lines.some((line) => line.section === section),
  );

  return (
    <section aria-label="Tax worksheet" className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-indigo-500/70 bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
        <h2 className="min-w-0 text-sm font-semibold">1702Q worksheet</h2>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {visible.length} of {total} lines
        </Badge>
      </header>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Line</TableHead>
              <TableHead className="min-w-[260px]">Item</TableHead>
              <TableHead className="w-[120px] text-right">Q1</TableHead>
              <TableHead className="w-[120px] text-right">Q2</TableHead>
              <TableHead className="w-[120px] text-right">Q3</TableHead>
              <TableHead className="w-[120px] text-right">Q4</TableHead>
              <TableHead className="w-[140px] text-right">Year</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <Fragment key={section}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={7} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {SECTION_LABEL[section]}
                  </TableCell>
                </TableRow>
                {visible
                  .filter((line) => line.section === section)
                  .map((line) => (
                    <TableRow key={line.key} className={cn(line.emphasis && "bg-muted/20 font-medium")}>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">{line.lineNo}</TableCell>
                      <TableCell className="max-w-[380px]">
                        <span className="block truncate" title={line.label}>
                          {line.label}
                        </span>
                        {line.hint ? (
                          <span className="block truncate text-[11px] text-muted-foreground" title={line.hint}>
                            {line.hint}
                          </span>
                        ) : null}
                      </TableCell>
                      {line.values.map((value, index) => (
                        <TableCell key={index} className="text-right tabular-nums">
                          {formatCurrency(value)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(line.yearValue)}</TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {hidden > 0 ? (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          {hidden} line{hidden === 1 ? "" : "s"} sit at zero for this year and are hidden.
        </p>
      ) : null}
    </section>
  );
}

