"use client";

import * as React from "react";
import { 
  Activity, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnalyticsSummary, HighRiskEntry } from "../types";

interface RiskInsightsProps {
  data: AnalyticsSummary;
  onOpenJournal: (entry: HighRiskEntry, opener: HTMLElement) => Promise<void>;
}

const ITEMS_PER_PAGE = 5;

export default function RiskInsights({ data, onOpenJournal }: RiskInsightsProps) {
  const [riskPage, setRiskPage] = React.useState(0);
  const [openingEntryKey, setOpeningEntryKey] = React.useState<number | null>(null);

  const statusEntries = Object.entries(data.statusBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const highRisk = data.highRiskEntries || [];
  
  const totalRiskPages = Math.ceil(highRisk.length / ITEMS_PER_PAGE);
  const currentRiskItems = highRisk.slice(
    riskPage * ITEMS_PER_PAGE, 
    (riskPage + 1) * ITEMS_PER_PAGE
  );

  const handleOpenJournal = async (entry: HighRiskEntry, opener: HTMLElement) => {
    setOpeningEntryKey(entry.jeGroupCounter);
    try {
      await onOpenJournal(entry, opener);
    } catch (error) {
      console.error("Unable to open flagged journal entry:", error);
      toast.error("Unable to load this journal entry. Please try again.");
    } finally {
      setOpeningEntryKey(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* 1. Status Breakdown */}
      <Card className="border shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden whitespace-nowrap">
        <CardHeader className="py-3 px-6 flex flex-row items-center gap-2 border-b bg-muted/20">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 px-6">
          <div className="flex flex-wrap items-center gap-3">
            {statusEntries.map(([status, count]) => (
              <div 
                key={status} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border shadow-sm"
              >
                <span className="text-sm font-medium text-muted-foreground">{status}:</span>
                <span className="text-sm font-semibold text-foreground">{count}</span>
              </div>
            ))}
            {statusEntries.length === 0 && (
              <span className="text-sm text-muted-foreground">No status data available</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. High-Risk Journal Entries */}
      <Card className="border border-rose-200/50 dark:border-rose-900/50 shadow-sm bg-rose-50/10 dark:bg-rose-950/20 overflow-hidden">
        <CardHeader className="py-3 px-6 flex flex-row items-center justify-between border-b border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
              High-Risk Journal Entries
            </CardTitle>
            <Badge className="bg-rose-600 text-white border-none text-xs h-4 px-2 font-medium ml-1">
              Risk Audit ACTIVE
            </Badge>
          </div>
          
          {totalRiskPages > 1 && (
            <div className="flex items-center gap-1">
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-rose-700 hover:bg-rose-100/50"
                onClick={() => setRiskPage(p => Math.max(0, p - 1))}
                disabled={riskPage === 0}
               >
                 <ChevronLeft className="h-3 w-3" />
               </Button>
               <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 px-1">
                 {riskPage + 1} / {totalRiskPages}
               </span>
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-rose-700 hover:bg-rose-100/50"
                onClick={() => setRiskPage(p => Math.min(totalRiskPages - 1, p + 1))}
                disabled={riskPage >= totalRiskPages - 1}
               >
                 <ChevronRight className="h-3 w-3" />
               </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-rose-100/30 dark:divide-rose-900/30">
            {currentRiskItems.map((entry, idx) => (
              <div
                key={entry.jeGroupCounter ?? `${entry.jeNo}-${idx}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
              >
                <div className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-sm font-semibold text-muted-foreground">{entry.jeNo}</span>
                  <button
                    type="button"
                    onClick={(event) => void handleOpenJournal(entry, event.currentTarget)}
                    disabled={openingEntryKey !== null}
                    aria-label={`View journal details for ${entry.jeNo}`}
                    aria-busy={openingEntryKey === entry.jeGroupCounter}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-sm text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                  >
                    View journal details
                    {openingEntryKey === entry.jeGroupCounter && <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
                  </button>
                </div>
                <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                  {entry.riskReasons.map((reason) => {
                    const presentation = getRiskReasonPresentation(reason);
                    const Icon = presentation.icon;
                    return (
                      <Badge key={reason} variant="outline" className={cn("gap-1.5 whitespace-normal text-left", presentation.className)}>
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {presentation.label}
                      </Badge>
                    );
                  })}
                </span>
              </div>
            ))}
            
            {highRisk.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-emerald-50/5 dark:bg-emerald-950/5">
                 <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-emerald-500" />
                 </div>
                 <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Audit Clean</p>
                 <p className="text-sm mt-1 text-muted-foreground">No high-risk indicators detected in current filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getRiskReasonPresentation(reason: string) {
  if (reason === "Imbalance") {
    return {
      label: "Debit and credit are out of balance",
      icon: AlertTriangle,
      className: "border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
    };
  }

  if (reason === "Large Entry") {
    return {
      label: "Amount exceeds ₱50,000 review threshold",
      icon: CircleDollarSign,
      className: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    };
  }

  return {
    label: reason,
    icon: Activity,
    className: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  };
}

function Zap({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <path d="M4 14.75V3.5a.5.5 0 0 1 .824-.372l14.5 12.676a.5.5 0 0 1-.33.846H9L5.158 22.047a.5.5 0 0 1-.849-.458L6 14.75z" />
        </svg>
    )
}
