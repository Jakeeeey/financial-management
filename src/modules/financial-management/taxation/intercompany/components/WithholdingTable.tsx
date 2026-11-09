"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import { ASSUMED_WITHHOLDING_LABEL, toneClass } from "../constants";
import { usePager } from "../hooks/usePager";
import { TablePager } from "./TablePager";
import type { WithholdingRow } from "../types";
import { VERDICT_STYLE } from "../withholding";

const PAGE_SIZE = 10;

const BASIS_LABEL: Record<WithholdingRow["basis"], string> = {
  SALES_INVOICE: "Seller's invoice line",
  PURCHASE_ORDER: "Buyer's purchase order only",
  NONE: "No document",
};

function recordedNote(row: WithholdingRow): string {
  if (row.recordedSource === "purchase_order") return "from the buyer's order";
  if (row.recordedSource === "sales_invoice") return "from the seller's invoice";
  return "nothing recorded";
}

export function WithholdingTable({ rows, isLoading }: { rows: WithholdingRow[]; isLoading: boolean }) {
  const [q, setQ] = useState("");
  const [verdict, setVerdict] = useState("ALL");
  const [basis, setBasis] = useState("ALL");

  const verdicts = useMemo(() => Array.from(new Set(rows.map((row) => row.verdict))), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (verdict !== "ALL" && row.verdict !== verdict) return false;
      if (basis !== "ALL" && row.basis !== basis) return false;
      if (!needle) return true;
      return [row.fromCode, row.fromName, row.toCode, row.toName]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, verdict, basis]);

  const { page, pageCount, pageRows, setPage } = usePager(visible, PAGE_SIZE);
  const dirty = q !== "" || verdict !== "ALL" || basis !== "ALL";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Withholding by pair</h2>
          <p className="text-xs text-muted-foreground">
            What the doc&apos;s rate would withhold, against what the payer actually recorded.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {visible.length} pair{visible.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {rows.length > 0 && (
        <div aria-label="Withholding filters" className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="Payer or payee code or name…"
                aria-label="Search pair"
                className="pl-8"
              />
            </div>

            <Select
              value={verdict}
              onValueChange={(value) => {
                setVerdict(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Verdict" className="w-full">
                <SelectValue placeholder="Verdict" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All verdicts</SelectItem>
                {verdicts.map((value) => (
                  <SelectItem key={value} value={value}>
                    {VERDICT_STYLE[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={basis}
              onValueChange={(value) => {
                setBasis(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Basis" className="w-full">
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All bases</SelectItem>
                <SelectItem value="SALES_INVOICE">{BASIS_LABEL.SALES_INVOICE}</SelectItem>
                <SelectItem value="PURCHASE_ORDER">{BASIS_LABEL.PURCHASE_ORDER}</SelectItem>
                <SelectItem value="NONE">{BASIS_LABEL.NONE}</SelectItem>
              </SelectContent>
            </Select>

            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setVerdict("ALL");
                  setBasis("ALL");
                  setPage(1);
                }}
              >
                <X aria-hidden className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2 px-4 py-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {rows.length === 0 ? "No pair to withhold on." : "No pair matches these filters."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table aria-label="Intercompany withholding by pair">
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Doc rate</TableHead>
                  <TableHead className="text-right">Recorded</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const verdict = VERDICT_STYLE[row.verdict];
                  return (
                    <TableRow key={`${row.fromCode}-${row.toCode}`}>
                      <TableCell className="max-w-[16rem]">
                        <span
                          className="block truncate font-medium"
                          title={`${row.fromCode} — ${row.fromName} → ${row.toCode} — ${row.toName}`}
                        >
                          {row.fromCode} → {row.toCode}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground" title={`${row.fromName} → ${row.toName}`}>
                          {row.fromName} → {row.toName}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{BASIS_LABEL[row.basis]}</TableCell>
                      <TableCell className="max-w-[20rem] whitespace-normal" title={row.rateLabel}>
                        {row.rate === null ? (
                          <span className="text-xs font-medium text-muted-foreground">not determinable</span>
                        ) : (
                          <>
                            <span className="block text-sm font-medium tabular-nums">
                              {Math.round(row.rate * 100)}%
                            </span>
                            <span className="block text-xs text-muted-foreground">{ASSUMED_WITHHOLDING_LABEL}</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.base)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.expected === null ? "—" : formatCurrency(row.expected)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="block tabular-nums">
                          {row.recorded === null ? "—" : formatCurrency(row.recorded)}
                        </span>
                        <span className="block text-xs text-muted-foreground">{recordedNote(row)}</span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.difference !== null && Math.abs(row.difference) > 1 && "text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {row.difference === null ? "—" : formatCurrency(row.difference)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[11px] font-medium", toneClass(verdict.tone))}>
                          {verdict.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            2% is the doc&apos;s rate for a service fee, assumed because no document records an income type.
          </p>

          <div className="border-t px-4 py-3">
            <TablePager
              page={page}
              pageCount={pageCount}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        </>
      )}
    </section>
  );
}
