import { ArrowDownToLine, Banknote, Clock, ScrollText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toneClass } from "../constants";

type Kpis = {
  undeposited: number;
  cash: number;
  checks: number;
  pendingSlips: number;
  overdueCash: number;
};

/** Four KPI tiles above the tables, mirroring the prototype's 1.3 header. */
export function DepositKpis({ totals }: { totals: Kpis }) {
  const tiles = [
    { label: "Undeposited", value: formatCurrency(totals.undeposited), icon: Banknote, tone: "info" as const },
    { label: "Cash on hand", value: formatCurrency(totals.cash), icon: ArrowDownToLine, tone: "neutral" as const },
    { label: "Checks held", value: formatCurrency(totals.checks), icon: ScrollText, tone: "neutral" as const },
    {
      label: "Cash over 1 day",
      value: totals.overdueCash === 0 ? "None" : `${totals.overdueCash} item${totals.overdueCash === 1 ? "" : "s"}`,
      icon: Clock,
      tone: totals.overdueCash > 0 ? ("warning" as const) : ("success" as const),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 truncate text-xl font-semibold tabular-nums" title={tile.value}>
                {tile.value}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-lg border p-2", toneClass(tile.tone))}>
              <tile.icon className="h-4 w-4" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Pending slips are shown separately so the header count stays honest. */
export function PendingSlipsNote({ count, slipCount }: { count: number; slipCount: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      {slipCount === 0
        ? "No deposit slips yet."
        : `${count} slip${count === 1 ? "" : "s"} awaiting bank clearing out of ${slipCount}.`}
    </p>
  );
}
