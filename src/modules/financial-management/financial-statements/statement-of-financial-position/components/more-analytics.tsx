import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { BalanceSheetComparisonStatus, KeyRatios } from "../types";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { balanceSheetRatioDefinitions, describeRatioChange, formatRatio } from "../utils/presentation";

interface Props {
  ratios: KeyRatios;
  comparisonStatus: BalanceSheetComparisonStatus;
}

function RatioItem({ title, formula, value, priorValue, variance, comparisonStatus, currentAsOf, comparisonAsOf }: {
  title: string;
  formula: string;
  value: number | null;
  priorValue: number | null;
  variance: number | null;
  comparisonStatus: BalanceSheetComparisonStatus;
  currentAsOf: string;
  comparisonAsOf: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-sm font-bold tracking-tight">{title}</span>
      <span className="text-xs text-muted-foreground">Formula: {formula}</span>
      <span className="mt-2 text-xs font-medium text-muted-foreground">Current · As of {currentAsOf}</span>
      <span className="text-2xl font-bold tracking-tight text-primary">{formatRatio(value)}</span>
      {value === null && <span className="text-xs text-muted-foreground">Not applicable because the denominator is zero.</span>}
      {comparisonStatus === "available" ? (
        <>
          <span className="mt-2 text-xs font-medium text-muted-foreground">Comparison · As of {comparisonAsOf}</span>
          <span className="text-base font-semibold">{formatRatio(priorValue)}</span>
          {priorValue === null && <span className="text-xs text-muted-foreground">Not applicable because the denominator is zero.</span>}
          <span className="mt-1 text-sm font-medium">
            {variance === null ? "Change not applicable for this ratio." : describeRatioChange(variance)}
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">
          {comparisonStatus === "unavailable"
            ? `Comparison unavailable${comparisonAsOf ? ` · requested as of ${comparisonAsOf}` : ""}`
            : "Comparison disabled"}
        </span>
      )}
    </div>
  );
}

export function BalanceSheetMoreAnalytics({ ratios, comparisonStatus }: Props) {
  const { appliedFilters } = useBalanceSheet();
  const formatReportDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  const currentAsOf = appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable";
  const comparisonAsOf = appliedFilters?.includeComparison
    ? formatReportDate(appliedFilters.comparisonEndDate)
    : null;

  return (
    <Collapsible defaultOpen={false} className="min-w-0">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="group h-auto min-h-12 w-full justify-between gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">More analytics</span>
            <span className="block text-xs font-normal text-muted-foreground">Key financial ratios</span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">
          Ratios are expressed as multiples (×), not percentages. Dates reflect the applied report: as of {currentAsOf}
          {comparisonAsOf ? ` and compared with as of ${comparisonAsOf}` : ""}.
        </p>
        <section aria-label="Key ratios" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {balanceSheetRatioDefinitions.map(({ key, label, formula }) => (
            <RatioItem
              key={key}
              title={label}
              formula={formula}
              value={ratios[key].current}
              priorValue={ratios[key].prior}
              variance={ratios[key].variance}
              comparisonStatus={comparisonStatus}
              currentAsOf={currentAsOf}
              comparisonAsOf={comparisonAsOf}
            />
          ))}
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
