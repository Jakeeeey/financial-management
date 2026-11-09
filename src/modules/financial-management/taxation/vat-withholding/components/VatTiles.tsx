"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { EntityProfile, VatComputation } from "../types";
import { carryOut, total } from "../vatMath";
import { toneClass } from "../constants";

/**
 * Year totals and the return that carries them.
 *
 * The badge is not decoration: a non-VAT company files 2551Q (percentage tax), so the
 * Output/Input/Net tiles read 0.00 for it and the payable is the percentage tax.
 */
export function VatTiles({ vat, profile }: { vat: VatComputation; profile: EntityProfile }) {
  const form = profile.vatRegistered ? "2550Q" : "2551Q";
  const carried = carryOut(vat);
  const openCredit = carried[carried.length - 1] ?? 0;

  const tiles = profile.vatRegistered
    ? [
        { label: "Output VAT", value: total(vat.outputVat) },
        { label: "Input VAT", value: total(vat.inputVat) },
        { label: "Net VAT payable", value: total(vat.payable) },
        { label: "Carried-forward credit", value: openCredit },
      ]
    : [
        { label: "Percentage tax payable", value: total(vat.payable) },
        { label: "Output VAT", value: 0 },
        { label: "Input VAT", value: 0 },
        { label: "Carried-forward credit", value: 0 },
      ];

  return (
    <section
      aria-label="VAT summary"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-emerald-500/70 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {profile.vatRegistered ? "VAT for the year" : "Percentage tax for the year"}
        </h2>
        <Badge variant="outline" className={toneClass("info")} title={`Quarterly return: ${form}`}>
          {form}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground" title={tile.label}>
              {tile.label}
            </dt>
            <dd className="mt-1 truncate text-lg font-semibold tabular-nums" title={formatCurrency(tile.value)}>
              {formatCurrency(tile.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
