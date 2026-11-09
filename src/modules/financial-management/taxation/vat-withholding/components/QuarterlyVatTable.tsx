"use client";

import { useState, type KeyboardEvent } from "react";

import { formatCurrency } from "@/lib/utils";
import { PERIOD_KEYS } from "../constants";
import { carryOut } from "../vatMath";
import type { QuarterFigures, VatComputation } from "../types";
import { QuarterDetailDialog } from "./QuarterDetailDialog";

/**
 * Quarterly 2550Q figures, one row per quarter.
 *
 * Zero-rated sales have no source in this system: the column says so instead of printing
 * 0.00, and the dialog repeats the same honest gap.
 */
export function QuarterlyVatTable({ figures, vat }: { figures: QuarterFigures[]; vat: VatComputation }) {
  const carried = carryOut(vat);
  const [selected, setSelected] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const money = (value: number | undefined) => (value == null ? "not available" : formatCurrency(value));

  function openQuarter(index: number) {
    setSelected(index);
    setDialogOpen(true);
  }

  function rowKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openQuarter(index);
  }

  const rows = PERIOD_KEYS.map((quarter, index) => ({
    quarter,
    index,
    output: vat.outputVat[index],
    input: vat.inputVat[index],
    carriedIn: vat.carriedIn[index],
    payable: vat.payable[index],
    carryOut: carried[index],
    sales: figures[index]?.sales,
  }));

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="hidden overflow-x-auto xl:block">
          <table aria-label="Quarterly VAT" className="w-full min-w-[900px] border-collapse text-sm">
            <caption className="sr-only">Output and input VAT per quarter, carried in and carried forward</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Quarter</th>
                <th scope="col" className="px-3 py-2 font-semibold">Zero-rated sales</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">VATable sales</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Output VAT</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Input VAT</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Carried in</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Payable</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Carry out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.quarter}
                  tabIndex={0}
                  aria-label={`Open ${row.quarter} VAT build-up`}
                  onClick={() => openQuarter(row.index)}
                  onKeyDown={(event) => rowKeyDown(event, row.index)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <td className="px-3 py-2.5 font-medium">{row.quarter}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground" title="Zero-rated sales are not recorded in this system">
                    Not recorded
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.sales)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.output)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.input)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.carriedIn)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{money(row.payable)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(row.carryOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y xl:hidden">
          {rows.map((row) => (
            <li
              key={row.quarter}
              tabIndex={0}
              aria-label={`Open ${row.quarter} VAT build-up`}
              onClick={() => openQuarter(row.index)}
              onKeyDown={(event) => rowKeyDown(event, row.index)}
              className="cursor-pointer space-y-2 px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <p className="text-sm font-medium">{row.quarter}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">VATable sales</dt>
                  <dd className="tabular-nums">{money(row.sales)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Output VAT</dt>
                  <dd className="tabular-nums">{money(row.output)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Input VAT</dt>
                  <dd className="tabular-nums">{money(row.input)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Carried in</dt>
                  <dd className="tabular-nums">{money(row.carriedIn)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Payable</dt>
                  <dd className="font-medium tabular-nums">{money(row.payable)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Carry out</dt>
                  <dd className="tabular-nums">{money(row.carryOut)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Zero-rated sales are not recorded in this system.
        </p>
      </section>

      <QuarterDetailDialog
        quarter={selected == null ? "Quarter" : (PERIOD_KEYS[selected] ?? "Quarter")}
        index={selected ?? 0}
        figures={selected == null ? undefined : figures[selected]}
        vat={vat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
