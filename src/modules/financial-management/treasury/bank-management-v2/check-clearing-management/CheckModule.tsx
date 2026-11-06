"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/utils";

import { statusLabel, statusTone, toneClass } from "./constants";
import { cn } from "@/lib/utils";
import { CheckActionDialog } from "./components/CheckActionDialog";
import { ChecksTable, type CheckAction } from "./components/ChecksTable";
import { NewCheckDialog } from "./components/NewCheckDialog";
import { OptionCombobox } from "./components/OptionCombobox";
import { useChecks } from "./hooks/useChecks";
import type { BankCheck } from "./types";

const STATUS_FILTERS = ["ALL", "PENDING", "RECEIVED", "IN_CLEARING", "CLEARED", "RETURNED", "CANCELLED"] as const;

/** Check & Clearing Management (FSD 1.4): register, status tiles and every check action. */
export function CheckModule() {
  const {
    checks,
    statusTiles,
    accounts,
    notice,
    filters,
    setFilters,
    page,
    setPage,
    isLoading,
    isSaving,
    error,
    refetch,
    issue,
    receive,
    act,
    loadDetail,
  } = useChecks();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [activeCheck, setActiveCheck] = useState<BankCheck | null>(null);
  const [activeAction, setActiveAction] = useState<CheckAction | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q: query.trim() || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, setFilters]);

  function handleAction(check: BankCheck, action: CheckAction) {
    setActiveCheck(check);
    setActiveAction(action);
  }

  const accountOptions = [
    { value: "ALL", label: "All accounts" },
    ...accounts.map((account) => ({ value: String(account.bankId), label: account.label })),
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Check &amp; Clearing Management</h1>
          <p className="text-sm text-muted-foreground">
            Track issued and received checks from release to clearing, returns and replacements.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setNewOpen(true)} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add check
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load the register</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <AlertTitle>Check register not available yet</AlertTitle>
          <AlertDescription className="break-words">{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statusTiles.map((tile) => (
          <Card key={tile.status} className="shadow-none">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {statusLabel(tile.status)}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(tile.count)}</p>
              <span className={cn("mt-2 inline-block h-1 w-8 rounded-full", toneClass(statusTone(tile.status)))} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search check no., payee or payor"
          className="w-full sm:w-[280px]"
        />
        <Select
          value={filters.direction ?? "ALL"}
          onValueChange={(value) => setFilters((current) => ({ ...current, direction: value }))}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="ALL">All directions</SelectItem>
            <SelectItem value="ISSUED">Issued</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? "ALL"}
          onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "ALL" ? "All statuses" : statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <OptionCombobox
          options={accountOptions}
          value={filters.accountId ? String(filters.accountId) : "ALL"}
          onChange={(value) =>
            setFilters((current) => ({ ...current, accountId: value === "ALL" ? undefined : Number(value) }))
          }
          placeholder="All accounts"
          searchPlaceholder="Search accounts"
          emptyLabel="No account matches that search."
          aria-label="Account filter"
          className="sm:w-[240px]"
        />
      </div>

      <ChecksTable
        checks={checks}
        isLoading={isLoading}
        page={page}
        onPageChange={setPage}
        onAction={handleAction}
      />

      <NewCheckDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        accounts={accounts}
        isSaving={isSaving}
        onIssue={issue}
        onReceive={receive}
      />

      <CheckActionDialog
        check={activeCheck}
        action={activeAction}
        open={activeCheck !== null && activeAction !== null}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) {
            setActiveCheck(null);
            setActiveAction(null);
          }
        }}
        onSubmit={act}
        loadDetail={loadDetail}
      />
    </div>
  );
}
