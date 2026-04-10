"use client";

import * as React from "react";
import { TrialBalanceHeader } from "./components/TrialBalanceHeader";
import { TrialBalanceFilters } from "./components/TrialBalanceFilters";
import { TrialBalanceSummary } from "./components/TrialBalanceSummary";
import { TrialBalanceDetailView } from "./components/TrialBalanceDetailView";
import { TrialBalanceSummaryView } from "./components/TrialBalanceSummaryView";
import { TrialBalanceDrillDown } from "./components/TrialBalanceDrillDown";
import { MOCK_ACCOUNTS } from "./constants";
import { TrialBalanceAccount } from "./types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function TrialBalanceView() {
  const [viewMode, setViewMode] = React.useState<"detail" | "summary">("detail");
  const [selectedAccount, setSelectedAccount] = React.useState<TrialBalanceAccount | null>(null);

  const totalDebit = MOCK_ACCOUNTS.reduce((sum, acc) => sum + (acc.debit > 0 ? acc.debit : 0), 0);
  const totalCredit = MOCK_ACCOUNTS.reduce((sum, acc) => sum + acc.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isOutofBalance = difference !== 0;

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

      <TrialBalanceSummary 
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        accountCount={MOCK_ACCOUNTS.length}
      />

      {isOutofBalance && (
        <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Out of Balance</AlertTitle>
          <AlertDescription>
            Report is out of balance by {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(difference)}. 
            Please review flagged accounts and regenerate after correction.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "detail" | "summary")}>
          <TabsList className="grid w-[200px] grid-cols-2 rounded-lg">
            <TabsTrigger value="detail" className="rounded-md">Detail View</TabsTrigger>
            <TabsTrigger value="summary" className="rounded-md">Summary View</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "detail" ? (
        <TrialBalanceDetailView data={MOCK_ACCOUNTS} />
      ) : (
        <TrialBalanceSummaryView 
          data={MOCK_ACCOUNTS} 
          onAccountClick={(acc) => setSelectedAccount(acc)} 
        />
      )}
    </div>
  );
}
