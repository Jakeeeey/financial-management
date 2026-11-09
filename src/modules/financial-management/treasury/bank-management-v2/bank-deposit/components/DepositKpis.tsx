import { ArrowDownToLine, Banknote, Clock, ScrollText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { toPhtDateString } from "../pht";
import { accentClass, toneClass } from "../constants";

type Kpis = {
  cash: number;
  cashCount: number;
  oldestCashDate: string | null;
  readyCheckTotal: number;
  readyCheckCount: number;
  pdcTotal: number;
  pdcCount: number;
  monthTotal: number;
  monthSlipCount: number;
};

/** The four tiles from the prototype's 1.3 header, same labels and sub-lines. */
export function DepositKpis({ totals }: { totals: Kpis }) {
  const tiles = [
    {
      label: "Undeposited cash",
      value: formatCurrency(totals.cash),
      sub: `${totals.cashCount} collection(s)${
        totals.oldestCashDate ? ` · oldest ${toPhtDateString(totals.oldestCashDate)}` : ""
      }`,
      icon: Banknote,
      tone: totals.cashCount > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      label: "Checks ready to deposit",
      value: formatCurrency(totals.readyCheckTotal),
      sub: `${totals.readyCheckCount} check(s)`,
      icon: ScrollText,
      tone: totals.readyCheckCount > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      label: "Post-dated checks",
      value: String(totals.pdcCount),
      sub: `${formatCurrency(totals.pdcTotal)} not yet deposit-able`,
      icon: Clock,
      tone: totals.pdcCount > 0 ? ("warning" as const) : ("neutral" as const),
    },
    {
      label: "Deposited this month",
      value: formatCurrency(totals.monthTotal),
      sub: `${totals.monthSlipCount} slip(s)`,
      icon: ArrowDownToLine,
      tone: totals.monthSlipCount > 0 ? ("success" as const) : ("neutral" as const),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className={cn(
            "overflow-hidden border-border/50 border-l-[3px] bg-gradient-to-br to-transparent shadow-none",
            accentClass(tile.tone),
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <span className={cn("shrink-0 rounded-lg border p-1.5", toneClass(tile.tone))} aria-hidden="true">
                <tile.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums" title={tile.value}>
              {tile.value}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={tile.sub}>
              {tile.sub}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
