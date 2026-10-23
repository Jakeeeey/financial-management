import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BalanceSheetComparisonStatus, KeyRatios, ValidationStatus } from "../types";

interface Props {
  validation: ValidationStatus;
  ratios: KeyRatios;
  comparisonStatus: BalanceSheetComparisonStatus;
}

const formatVariance = (variance: number) => variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2);

function RatioItem({ title, subtitle, value, priorValue, variance, comparisonStatus }: {
  title: string;
  subtitle: string;
  value: number;
  priorValue: number | null;
  variance: number | null;
  comparisonStatus: BalanceSheetComparisonStatus;
}) {
  const isPositive = variance !== null && variance > 0;
  const isNegative = variance !== null && variance < 0;

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-sm font-bold tracking-tight">{title}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{subtitle}</span>
      <span className="mt-1 text-2xl font-bold tracking-tight text-primary">{value.toFixed(2)}x</span>
      {comparisonStatus === "available" && priorValue !== null && variance !== null ? (
        <span className={cn("text-xs font-bold", isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground")}>
          vs prior {priorValue.toFixed(2)}x ({formatVariance(variance)}x)
        </span>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">
          {comparisonStatus === "unavailable" ? "Comparison unavailable" : "Comparison disabled"}
        </span>
      )}
    </div>
  );
}

export function BalanceSheetMoreAnalytics({ validation, ratios, comparisonStatus }: Props) {
  const isBalanced = validation.isBalanced;

  return (
    <Collapsible defaultOpen={false} className="min-w-0">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="group h-auto min-h-12 w-full justify-between gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">More analytics</span>
            <span className="block text-xs font-normal text-muted-foreground">Accounting equation check and key ratios</span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <section className={cn("rounded-lg border p-4", isBalanced ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5")}>
          <div className="flex items-start gap-3">
            {isBalanced ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
            <div className="min-w-0">
              <h3 className="text-sm font-bold">Accounting Equation Check</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Total Assets − (Total Liabilities + Equity) = {validation.variance < 0 ? "−" : ""}₱{Math.abs(validation.variance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={cn("mt-2 text-xs font-bold", isBalanced ? "text-success" : "text-destructive")}>
                {isBalanced ? "Report is balanced and ready for review." : "The Financial Statement Generated is not Balanced."}
              </p>
            </div>
          </div>
        </section>
        <section aria-label="Key ratios" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RatioItem title="Current Ratio" subtitle="Current Assets / Current Liabilities" value={ratios.currentRatio.current} priorValue={ratios.currentRatio.prior} variance={ratios.currentRatio.variance} comparisonStatus={comparisonStatus} />
          <RatioItem title="Debt to Equity" subtitle="Total Liabilities / Total Equity" value={ratios.debtToEquity.current} priorValue={ratios.debtToEquity.prior} variance={ratios.debtToEquity.variance} comparisonStatus={comparisonStatus} />
          <RatioItem title="Quick Ratio" subtitle="(CA - Inventory) / CL" value={ratios.quickRatio.current} priorValue={ratios.quickRatio.prior} variance={ratios.quickRatio.variance} comparisonStatus={comparisonStatus} />
          <RatioItem title="Debt Ratio" subtitle="Total Liabilities / Total Assets" value={ratios.debtRatio.current} priorValue={ratios.debtRatio.prior} variance={ratios.debtRatio.variance} comparisonStatus={comparisonStatus} />
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
