"use client";

import { useState } from "react";
import { Plus , ArrowLeftRight} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CancelMemoDialog } from "./components/CancelMemoDialog";
import { InlineAlert } from "./components/InlineAlert";
import { NewTransactionDialog } from "./components/NewTransactionDialog";
import { TransactionDetailDialog } from "./components/TransactionDetailDialog";
import { TransactionFiltersBar } from "./components/TransactionFilters";
import { TransactionsTable } from "./components/TransactionsTable";
import { TransfersClearingPanel } from "./components/TransfersClearingPanel";
import { useTransactions } from "./hooks/useTransactions";
import type { TransactionRow } from "./types";

/**
 * The lane's single screen: the combined memo + transfer list, the clearing panel and the
 * four-type dialog. All fetching lives in the hook; this file only wires state to components.
 */
export function TransactionsModule() {
  const {
    filters,
    patchFilters,
    resetFilters,
    refetch,
    rows,
    total,
    page,
    pageCount,
    pageSize,
    accounts,
    expenseAccounts,
    clearing,
    mappingMissing,
    knownKinds,
    notice,
    isLoading,
    isSaving,
    error,
    createMemo,
    createTransfer,
    settle,
    cancelMemo,
  } = useTransactions();

  const isFiltered =
    filters.kind !== "ALL" ||
    filters.status !== "" ||
    filters.q.trim() !== "" ||
    filters.from !== "" ||
    filters.to !== "" ||
    filters.bankAccountId != null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<TransactionRow | null>(null);
  const [openRow, setOpenRow] = useState<TransactionRow | null>(null);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ArrowLeftRight className="size-5" />
            </div>
            <h1 className="text-xl font-semibold sm:text-2xl">Cash &amp; Bank Transactions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Money in and out of the group&apos;s bank accounts, each posted as a journal entry.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="min-h-11 shrink-0 md:min-h-0">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New transaction
        </Button>
      </div>

      {notice ? <InlineAlert tone="info">{notice}</InlineAlert> : null}

      {error && rows.length > 0 ? (
        <InlineAlert>
          <span className="mr-2">{error}</span>
          <Button variant="link" className="h-auto p-0 text-destructive underline" onClick={refetch}>
            Try again
          </Button>
        </InlineAlert>
      ) : null}

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions" className="min-h-11 md:min-h-0">
            Bank transactions
          </TabsTrigger>
          <TabsTrigger value="clearing" className="min-h-11 md:min-h-0">
            Transfers in clearing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <TransactionsTable
            rows={rows}
            isLoading={isLoading}
            isSaving={isSaving}
            page={page}
            pageCount={pageCount}
            total={total}
            isFiltered={isFiltered}
            pageSize={pageSize}
            onPageChange={(next) => patchFilters({ page: next })}
            onCancelMemo={setCancelTarget}
            onSettle={(row) => void settle(row)}
            onOpenRow={setOpenRow}
            isError={Boolean(error)}
            onRetry={refetch}
            filters={
              <TransactionFiltersBar
                filters={filters}
                accounts={accounts}
                kinds={knownKinds}
                onChange={patchFilters}
                onReset={resetFilters}
              />
            }
          />
        </TabsContent>

        <TabsContent value="clearing">
          <TransfersClearingPanel
            clearing={clearing}
            mappingMissing={mappingMissing}
            isLoading={isLoading}
            isSaving={isSaving}
            onSettle={(row) => void settle(row)}
            onOpenRow={setOpenRow}
          />
        </TabsContent>
      </Tabs>

      <TransactionDetailDialog
        row={openRow}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) setOpenRow(null);
        }}
        onSettle={(row) => {
          setOpenRow(null);
          void settle(row);
        }}
        onCancelMemo={(row) => {
          setOpenRow(null);
          setCancelTarget(row);
        }}
      />

      <NewTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        expenseAccounts={expenseAccounts}
        isSaving={isSaving}
        onCreateMemo={createMemo}
        onCreateTransfer={createTransfer}
        onPosted={() => setDialogOpen(false)}
      />

      <CancelMemoDialog
        key={cancelTarget?.key ?? "cancel-memo"}
        memo={cancelTarget}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        onConfirm={cancelMemo}
      />
    </div>
  );
}
