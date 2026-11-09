"use client";

import { useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { MonthlyWithholdingRow } from "../types";
import { MonthDetailDialog } from "./MonthDetailDialog";

const numeric = "text-right tabular-nums";

/**
 * Withholding per month, exactly as purchase orders recorded it.
 *
 * The 0619-E / 1601-EQ columns place the month's recorded amount on the return it belongs
 * to. They are not remittances: this system keeps no filing or payment ledger.
 */
export function MonthlyWithholdingTable({ rows }: { rows: MonthlyWithholdingRow[] }) {
  const [selected, setSelected] = useState<MonthlyWithholdingRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openRow(row: MonthlyWithholdingRow) {
    setSelected(row);
    setDialogOpen(true);
  }

  function rowKeyDown(event: KeyboardEvent, row: MonthlyWithholdingRow) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openRow(row);
  }

  const due = (value: number | null) => (value == null ? "—" : formatCurrency(value));

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="hidden overflow-x-auto xl:block">
          <table aria-label="Monthly withholding" className="w-full min-w-[900px] border-collapse text-sm">
            <caption className="sr-only">Withholding per month and the return it is filed on</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Month</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Purchases subject to withholding</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Tax withheld</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">0619-E due</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">1601-EQ due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.month}
                  tabIndex={0}
                  aria-label={`Open ${row.label} withholding`}
                  onClick={() => openRow(row)}
                  onKeyDown={(event) => rowKeyDown(event, row)}
                  className={cn(
                    "cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none",
                    row.quarterEnd && "bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium" title={row.label}>
                        {row.label}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {row.quarter}
                      </Badge>
                    </span>
                  </td>
                  <td className={numeric}>{formatCurrency(row.purchases)}</td>
                  <td className={cn(numeric, "font-medium")}>{formatCurrency(row.withheld)}</td>
                  <td className={numeric}>{due(row.agentDue)}</td>
                  <td className={numeric}>{due(row.quarterlyDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y xl:hidden">
          {rows.map((row) => (
            <li
              key={row.month}
              tabIndex={0}
              aria-label={`Open ${row.label} withholding`}
              onClick={() => openRow(row)}
              onKeyDown={(event) => rowKeyDown(event, row)}
              className={cn(
                "cursor-pointer space-y-2 px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none",
                row.quarterEnd && "bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium" title={row.label}>
                  {row.label}
                </p>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {row.quarter}
                  {row.quarterEnd ? " · quarter end" : ""}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Purchases</dt>
                  <dd className="tabular-nums">{formatCurrency(row.purchases)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Withheld</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(row.withheld)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">0619-E due</dt>
                  <dd className="tabular-nums">{due(row.agentDue)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">1601-EQ due</dt>
                  <dd className="tabular-nums">{due(row.quarterlyDue)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Amounts come from purchase orders; this system keeps no remittance ledger.
        </p>
      </section>

      <MonthDetailDialog row={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
