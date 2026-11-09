import { formatCurrency, formatNumber } from "@/lib/utils";
import { accentClass, type Tone } from "../constants";
import type { GroupTotals } from "../types";

const int = (value: number) => formatNumber(value, "en-PH", 0);

const DOT: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground/40",
};

/** `toneClass` paints a badge (border + wash); these metrics only want the ink. */
const INK: Record<Tone, string> = {
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  info: "text-blue-700 dark:text-blue-300",
  neutral: "text-foreground",
};

type Metric = {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
};

/**
 * Two panels, not six cards.
 *
 * The number a partner reads first is the group's net payable, so it gets a hero band with the
 * arithmetic that produced it visible beside it. Everything else is a supporting metric: same
 * panel, stacked rows, so they can be scanned without competing for weight.
 */
export function GroupKpis({ totals }: { totals: GroupTotals }) {
  const metrics: Metric[] = [
    {
      label: "Group VAT payable",
      value: formatCurrency(totals.vatPayable),
      sub: "2550Q output VAT less input VAT",
      tone: totals.vatPayable > 0 ? "warning" : "success",
    },
    {
      label: "Group withholding withheld",
      value: formatCurrency(totals.withholding),
      sub: "expanded withholding on the year's sales",
      tone: "neutral",
    },
    {
      label: "Overpaid companies",
      value: `${int(totals.overpaidCompanies)} of ${int(totals.companyCount)}`,
      sub: `${formatCurrency(totals.overpaid)} sitting as credit`,
      tone: totals.overpaidCompanies > 0 ? "info" : "neutral",
    },
    {
      label: "Companies unreadable",
      value: `${int(totals.unreadableCompanies)} of ${int(totals.companyCount)}`,
      sub: totals.unreadableCompanies > 0 ? "Their figures are excluded, not zeroed" : "Every company answered",
      tone: totals.unreadableCompanies > 0 ? "danger" : "success",
    },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <section
        aria-label="Group tax position"
        className={`flex flex-col justify-between gap-5 rounded-2xl border border-border/50 border-l-[3px] bg-gradient-to-br to-transparent p-5 shadow-sm ${accentClass(
          totals.netPayable > 0 ? "warning" : "success",
        )}`}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group net payable</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(totals.netPayable)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            after withholding credits and prior-year excess, across {int(totals.readableCompanies)} readable{" "}
            {totals.readableCompanies === 1 ? "company" : "companies"}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t border-border/50 pt-4 text-sm">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Income tax due</dt>
            <dd className="mt-0.5 truncate tabular-nums" title={formatCurrency(totals.taxDue)}>
              {formatCurrency(totals.taxDue)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Less credits</dt>
            <dd className="mt-0.5 truncate tabular-nums text-muted-foreground" title={formatCurrency(totals.overpaid)}>
              −{formatCurrency(totals.overpaid)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net position</dt>
            <dd className="mt-0.5 truncate font-medium tabular-nums" title={formatCurrency(totals.netPayable)}>
              {formatCurrency(totals.netPayable)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-label="Supporting group metrics"
        className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
      >
        <ul className="divide-y divide-border/60">
          {metrics.map((metric) => (
            <li key={metric.label} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[metric.tone]}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={metric.label}>
                    {metric.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground" title={metric.sub}>
                    {metric.sub}
                  </p>
                </div>
              </div>
              <p className={`shrink-0 text-right text-base font-semibold tabular-nums ${INK[metric.tone]}`}>
                {metric.value}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
