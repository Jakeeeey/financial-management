"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AssetDetailDialog } from "./components/AssetDetailDialog";
import { DepositKpis, PendingSlipsNote } from "./components/DepositKpis";
import { NewDepositDialog } from "./components/NewDepositDialog";
import { SlipDetailDialog } from "./components/SlipDetailDialog";
import { SlipsTable } from "./components/SlipsTable";
import { UndepositedTable } from "./components/UndepositedTable";
import { useDeposit } from "./hooks/useDeposit";
import type { DepositSlip, UndepositedAsset } from "./types";

/** Bank Deposit (FSD 1.3): vault assets, slip creation and slip cancellation. */
export function DepositModule() {
  const {
    assets,
    filteredAssets,
    filters,
    setFilters,
    filteredSlips,
    slipFilters,
    setSlipFilters,
    slips,
    accounts,
    totals,
    isLoading,
    isSaving,
    error,
    refetch,
    createSlip,
    cancelSlip,
    assetsPage,
    setAssetsPage,
    slipsPage,
    setSlipsPage,
  } = useDeposit();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState("undeposited");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeSlip, setActiveSlip] = useState<DepositSlip | null>(null);
  const [openAsset, setOpenAsset] = useState<UndepositedAsset | null>(null);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.collectionDetailId)),
    [assets, selected],
  );

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // `selected` is a set of asset ids that outlives the page, so a page-scoped select-all
  // merges into it; replacing the set would drop picks made on other pages.
  function toggleAll(checked: boolean, ids: number[]) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  // Same merge as `toggleAll`: choosing everything ready must not drop picks made earlier.
  function selectAllReady(ids: number[]) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function openCreate() {
    if (selectedAssets.length === 0) return;
    setCreateOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Bank Deposit</h1>
          <p className="text-sm text-muted-foreground">
            Deposit undeposited collections and customer checks, then track each slip until the bank clears it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={openCreate}
            disabled={selectedAssets.length === 0}
            title={selectedAssets.length === 0 ? "Select at least one undeposited collection or check below" : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            New deposit slip
            {selectedAssets.length > 0 && (
              <span className="ml-2 rounded bg-primary-foreground/20 px-1.5 text-xs">{selectedAssets.length}</span>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load deposits</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <DepositKpis totals={totals} />
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-3">
        <TabsList className="min-h-11">
          <TabsTrigger value="undeposited" className="min-h-11">
            Undeposited collections
            <span className="ml-2 text-xs tabular-nums text-muted-foreground">{assets.length}</span>
          </TabsTrigger>
          <TabsTrigger value="slips" className="min-h-11">
            Deposit slips
            <span className="ml-2 text-xs tabular-nums text-muted-foreground">{slips.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="undeposited">
          <UndepositedTable
            assets={filteredAssets}
            totalCount={assets.length}
            filters={filters}
            selected={selected}
            isLoading={isLoading}
            page={assetsPage}
            onPageChange={setAssetsPage}
            onFiltersChange={setFilters}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onSelectAllReady={selectAllReady}
            onDeselectAll={() => setSelected(new Set())}
            onOpenRow={setOpenAsset}
          />
        </TabsContent>

        <TabsContent value="slips" className="space-y-3">
          <PendingSlipsNote count={totals.pendingSlips} slipCount={slips.length} />
          <SlipsTable
            slips={filteredSlips}
            allSlips={slips}
            totalCount={slips.length}
            filters={slipFilters}
            isLoading={isLoading}
            page={slipsPage}
            onPageChange={setSlipsPage}
            onFiltersChange={setSlipFilters}
            onView={(slip) => setActiveSlip(slip)}
          />
        </TabsContent>
      </Tabs>

      <NewDepositDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setSelected(new Set());
        }}
        accounts={accounts}
        assets={selectedAssets}
        isSaving={isSaving}
        onSubmit={createSlip}
      />

      <AssetDetailDialog
        asset={openAsset}
        selected={openAsset ? selected.has(openAsset.collectionDetailId) : false}
        onOpenChange={(open) => {
          if (!open) setOpenAsset(null);
        }}
        onToggle={toggle}
      />

      <SlipDetailDialog
        slip={activeSlip}
        open={activeSlip !== null}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) setActiveSlip(null);
        }}
        onCancel={cancelSlip}
      />
    </div>
  );
}
