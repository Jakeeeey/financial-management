"use client";

import { useState } from "react";
import { Info, Plus, RefreshCw , Landmark} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useOnboarding } from "./hooks/useOnboarding";
import type { BankAccountV2 } from "./types";
import { AccountsTable } from "./components/AccountsTable";
import { EditAccountDialog } from "./components/EditAccountDialog";
import { OnboardingFilters } from "./components/OnboardingFilters";
import { PostingSetupDialog } from "./components/PostingSetupDialog";
import { RegisterAccountDialog } from "./components/RegisterAccountDialog";

/** Register of every bank account, with the FSD 1.1 create and edit flows. */
export function OnboardingModule() {
  const {
    accounts,
    total,
    registerTotal,
    options,
    glMapping,
    notice,
    filters,
    page,
    pageSize,
    activeFilterCount,
    isLoading,
    isSaving,
    error,
    refetch,
    updateFilter,
    resetFilters,
    setPage,
    setPageSize,
    registerAccount,
    saveAccount,
    retryOpeningBalance,
    saveMapping,
    settleDue,
  } = useOnboarding();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountV2 | null>(null);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Landmark className="size-5" />
            </div>
            <h1 className="text-xl font-semibold sm:text-2xl">Bank &amp; Account Onboarding</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            The accounts the group collects into, pays from and disburses out of.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PostingSetupDialog
            mapping={glMapping}
            chartAccounts={options.chartAccounts}
            onSaveMapping={saveMapping}
            onSettleDue={settleDue}
            isSaving={isSaving}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Refresh register"
            title="Refresh register"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden="true" />
          </Button>
          <Button type="button" onClick={() => setRegisterOpen(true)} className="min-h-11 md:min-h-0">
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Register account
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the account register</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {notice && !error ? (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription className="break-words">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <AccountsTable
        filters={
          <OnboardingFilters
            filters={filters}
            options={options}
            activeFilterCount={activeFilterCount}
            onChange={updateFilter}
            onReset={resetFilters}
          />
        }
        accounts={accounts}
        isLoading={isLoading}
        total={total}
        registerTotal={registerTotal}
        isFiltered={activeFilterCount > 0}
        page={page}
        pageSize={pageSize}
        onEdit={setEditing}
        onPostOpeningBalance={(account) => void retryOpeningBalance(account.bankId)}
        isSaving={isSaving}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <RegisterAccountDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        options={options}
        isSaving={isSaving}
        onSubmit={registerAccount}
      />

      <EditAccountDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        account={editing}
        options={options}
        isSaving={isSaving}
        onSubmit={saveAccount}
      />
    </div>
  );
}
