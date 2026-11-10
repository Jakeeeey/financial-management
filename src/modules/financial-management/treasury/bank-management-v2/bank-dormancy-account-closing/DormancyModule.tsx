"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw , MoonStar} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDormancy } from "./hooks/useDormancy";
import { DormancyFilters } from "./components/DormancyFilters";
import { DormancyTable } from "./components/DormancyTable";
import { CloseAccountPanel } from "./components/CloseAccountPanel";
import { AccountActionDialog, type AccountAction } from "./components/AccountActionDialog";
import { AccountDetailDialog } from "./components/AccountDetailDialog";
import { bankOptions } from "./providers/dormancyApi";
import { PAGE_SIZE } from "./constants";
import type { DormancyAccount, PreClosureResult } from "./types";

/**
 * Sub-module 1.5 — Dormancy & Account Closing.
 *
 * Two jobs: the Table 9 inactivity scan that reclassifies dormant deposits to GL 201800
 * (E16) or escheats them after ten years (E17), and the three-step closure gate that
 * settles the last interest (E18) and locks the status for good.
 */
export function DormancyModule() {
  const dormancy = useDormancy();
  const [detail, setDetail] = useState<DormancyAccount | null>(null);
  const [pending, setPending] = useState<{ account: DormancyAccount; action: AccountAction } | null>(null);
  const [preClosure, setPreClosure] = useState<PreClosureResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const validate = async (bankId: number) => {
    setIsChecking(true);
    const result = await dormancy.loadPreClosure(bankId);
    setPreClosure(result);
    setIsChecking(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <MoonStar className="size-5" />
            </div>
            <h1 className="text-xl font-semibold sm:text-2xl">Dormancy &amp; Account Closing</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Watch accounts that have gone quiet, reclassify dormant ones, and close accounts once they settle.
          </p>
        </div>
        <Button variant="outline" onClick={() => void dormancy.refetch()} disabled={dormancy.isLoading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${dormancy.isLoading ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh scan
        </Button>
      </header>

      {dormancy.notice && (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>Dormancy columns are missing</AlertTitle>
          <AlertDescription>{dormancy.notice}</AlertDescription>
        </Alert>
      )}

      {dormancy.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>The scan could not be loaded</AlertTitle>
          <AlertDescription>{dormancy.error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="scan" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scan" className="min-h-11 md:min-h-0">
            Inactivity scan
          </TabsTrigger>
          <TabsTrigger value="closure" className="min-h-11 md:min-h-0">
            Account closure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan">
          <DormancyTable
            filters={
              <DormancyFilters
                filters={dormancy.filters}
                banks={bankOptions(dormancy.accounts)}
                onChange={dormancy.setFilters}
              />
            }
            accounts={dormancy.visibleAccounts}
            total={dormancy.filteredCount}
            page={dormancy.page}
            pageCount={dormancy.pageCount}
            pageSize={PAGE_SIZE}
            isLoading={dormancy.isLoading}
            isSaving={dormancy.isSaving}
            onPageChange={dormancy.setPage}
            onOpen={setDetail}
            onReclassify={(account) => setPending({ account, action: "RECLASSIFY" })}
            onEscheat={(account) => setPending({ account, action: "ESCHEAT" })}
          />
        </TabsContent>

        <TabsContent value="closure">
          <CloseAccountPanel
            accounts={dormancy.accounts.filter((account) => account.status !== "CLOSED")}
            preClosure={preClosure}
            isLoadingCheck={isChecking}
            isSaving={dormancy.isSaving}
            onValidate={validate}
            onSettle={async (bankId, accruedInterest, cutOff) => {
              const ok = await dormancy.settle(bankId, accruedInterest, cutOff);
              if (ok) await validate(bankId);
              return ok;
            }}
            onLock={async (bankId, reason) => {
              const ok = await dormancy.lock(bankId, reason);
              if (ok) setPreClosure(null);
              return ok;
            }}
          />
        </TabsContent>
      </Tabs>

      <AccountDetailDialog account={detail} onOpenChange={(open) => !open && setDetail(null)} />

      <AccountActionDialog
        account={pending?.account ?? null}
        action={pending?.action ?? null}
        isSaving={dormancy.isSaving}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={async (account, action) => {
          const ok = action === "RECLASSIFY" ? await dormancy.reclassify(account.bankId) : await dormancy.escheat(account.bankId);
          if (ok) setPending(null);
        }}
      />
    </div>
  );
}
