"use client";

import * as React from "react";
import { TrialBalanceHeader } from "./components/TrialBalanceHeader";
import { TrialBalanceFilters } from "./components/TrialBalanceFilters";
import { TrialBalanceSummary } from "./components/TrialBalanceSummary";
import { TrialBalanceReportContext } from "./components/TrialBalanceReportContext";
import { TrialBalanceAppliedFilters } from "./components/TrialBalanceAppliedFilters";
import { INITIAL_TRIAL_BALANCE_DETAIL_VIEW_STATE, TrialBalanceDetailView, type TrialBalanceDetailViewState } from "./components/TrialBalanceDetailView";
import { TrialBalanceSummaryView } from "./components/TrialBalanceSummaryView";
import { TrialBalanceDrillDown } from "./components/TrialBalanceDrillDown";
import { TrialBalanceItem } from "./types/trial-balance.schema";
import { TrialBalanceProvider } from "./providers/TrialBalanceProvider";
import { useTrialBalance } from "./hooks/useTrialBalance";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getTrialBalanceDifferenceMessage } from "./utils/summary";

function TrialBalanceContent() {
  const { items, summary, reportContext, isLoading, error } = useTrialBalance();
  const [viewMode, setViewMode] = React.useState<"detail" | "summary">("detail");
  const [selectedAccount, setSelectedAccount] = React.useState<TrialBalanceItem | null>(null);
  const [tableState, setTableState] = React.useState<TrialBalanceDetailViewState>(INITIAL_TRIAL_BALANCE_DETAIL_VIEW_STATE);
  const returnFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const returnScrollRef = React.useRef<number | null>(null);
  const isPosted = reportContext?.postedOnly || reportContext?.status.toLowerCase() === "posted";

  const openAccount = (account: TrialBalanceItem, trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    returnScrollRef.current = window.scrollY;
    setSelectedAccount(account);
  };

  React.useEffect(() => {
    if (selectedAccount || !returnFocusRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (returnScrollRef.current !== null) window.scrollTo(0, returnScrollRef.current);
      returnFocusRef.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
      returnScrollRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedAccount]);

  if (selectedAccount) {
    return (
      <TrialBalanceDrillDown
        account={selectedAccount}
        onBack={() => setSelectedAccount(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <TrialBalanceHeader />

      <TrialBalanceFilters />

      <TrialBalanceReportContext />
      <TrialBalanceAppliedFilters />

      {reportContext && <TrialBalanceSummary summary={summary} />}

      {reportContext && summary.scope === "report" && !summary.isBalanced && items.length > 0 && (
        <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isPosted ? "Report debit–credit mismatch" : "Provisional report difference"}</AlertTitle>
          <AlertDescription>
            {getTrialBalanceDifferenceMessage(summary.difference)}. This applies to the complete report for the reporting period and transaction scope shown above.
            {!isPosted && " This is a provisional report that includes unposted transactions."}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "detail" | "summary")}>
          <TabsList className="grid w-fit grid-cols-2 rounded-lg">
            <TabsTrigger value="detail" className="min-w-32 rounded-md">Account table</TabsTrigger>
            <TabsTrigger value="summary" className="min-w-32 rounded-md">Account cards</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "detail" ? (
        <TrialBalanceDetailView
          data={items}
          isLoading={isLoading}
          onAccountClick={openAccount}
          state={tableState}
          onStateChange={setTableState}
        />
      ) : (
        <TrialBalanceSummaryView
          data={items}
          onAccountClick={openAccount}
        />
      )}
    </div>
  );
}

export function TrialBalanceView() {
  return (
    <TrialBalanceProvider>
      <TrialBalanceContent />
    </TrialBalanceProvider>
  );
}
