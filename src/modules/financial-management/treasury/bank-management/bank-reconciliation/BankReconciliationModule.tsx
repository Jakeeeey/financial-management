// src/modules/financial-management/treasury/bank-management/bank-reconciliation/BankReconciliationModule.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useBankReconciliation } from "./hooks/useBankReconciliation";
import type {
  BankReconciliation,
  BankReconciliationBank,
  BankReconciliationFormValues,
  ReconciliationStatus,
} from "./types";

const PAGE_SIZE = 10;
const statuses: Array<ReconciliationStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "RECONCILED",
];

const emptyForm: BankReconciliationFormValues = {
  bankId: "",
  statementDate: new Date().toISOString().slice(0, 10),
  statementBalance: "",
};

type BankSelectProps = {
  banks: BankReconciliationBank[];
  value: string;
  placeholder: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

type PendingReconciliation = BankReconciliation | null;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isZeroVariance(value: number) {
  return Math.abs(value) < 0.005;
}

function statusBadgeVariant(status: ReconciliationStatus) {
  return status === "RECONCILED" ? "default" : "outline";
}

function validateForm(values: BankReconciliationFormValues) {
  const statementBalance = Number(values.statementBalance);

  if (!values.bankId) return "Bank account is required";
  if (!values.statementDate) return "Statement date is required";
  if (!Number.isFinite(statementBalance)) {
    return "Statement balance must be a valid number";
  }
  return null;
}

function BankSelect({
  banks,
  value,
  placeholder,
  disabled,
  onValueChange,
}: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedBank = banks.find((bank) => String(bank.bankId) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-between",
            !value && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedBank?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search bank..." />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No banks found.</CommandEmpty>
            <CommandGroup>
              {banks.map((bank) => (
                <CommandItem
                  key={bank.bankId}
                  value={bank.label}
                  onSelect={() => {
                    onValueChange(String(bank.bankId));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(bank.bankId) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{bank.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function BankReconciliationModule() {
  const {
    data,
    loading,
    saving,
    error,
    systemBalancePreview,
    systemBalanceLoading,
    systemBalanceError,
    loadReconciliations,
    createReconciliation,
    loadSystemBalancePreview,
    resetSystemBalancePreview,
    updateStatus,
  } = useBankReconciliation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReconciliationStatus | "ALL">("ALL");
  const [bankId, setBankId] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState<BankReconciliationFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingReconciliation, setPendingReconciliation] =
    useState<PendingReconciliation>(null);

  const totalPages = Math.max(1, data.pagination.totalPages);
  const draftCount = useMemo(
    () => data.reconciliations.filter((item) => item.status === "DRAFT").length,
    [data.reconciliations],
  );
  const reconciledCount = useMemo(
    () =>
      data.reconciliations.filter((item) => item.status === "RECONCILED").length,
    [data.reconciliations],
  );
  const varianceCount = useMemo(
    () => data.reconciliations.filter((item) => !isZeroVariance(item.variance)).length,
    [data.reconciliations],
  );
  const projectedVariance = useMemo(() => {
    const statementBalance = Number(formValues.statementBalance);
    if (!systemBalancePreview || !Number.isFinite(statementBalance)) return null;
    return Math.round((statementBalance - systemBalancePreview.systemBalance) * 100) / 100;
  }, [formValues.statementBalance, systemBalancePreview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReconciliations({
        page,
        pageSize: PAGE_SIZE,
        search,
        status,
        bankId: bankId === "ALL" ? null : Number(bankId),
        startDate,
        endDate,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [bankId, endDate, loadReconciliations, page, search, startDate, status]);

  useEffect(() => {
    if (!dialogOpen || !formValues.bankId || !formValues.statementDate) {
      resetSystemBalancePreview();
      return;
    }

    const selectedBankId = Number(formValues.bankId);
    if (!Number.isFinite(selectedBankId) || selectedBankId <= 0) {
      resetSystemBalancePreview();
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSystemBalancePreview(selectedBankId, formValues.statementDate);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    dialogOpen,
    formValues.bankId,
    formValues.statementDate,
    loadSystemBalancePreview,
    resetSystemBalancePreview,
  ]);

  function updateFormValue(id: keyof BankReconciliationFormValues, value: string) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  function openCreateDialog() {
    setFormValues(emptyForm);
    setFormError(null);
    resetSystemBalancePreview();
    setDialogOpen(true);
  }

  async function reloadCurrentPage(nextPage = page) {
    await loadReconciliations({
      page: nextPage,
      pageSize: PAGE_SIZE,
      search,
      status,
      bankId: bankId === "ALL" ? null : Number(bankId),
      startDate,
      endDate,
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(formValues);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const saved = await createReconciliation(formValues);
    if (!saved) return;

    setDialogOpen(false);
    setPage(1);
    await reloadCurrentPage(1);
  }

  async function confirmReconcile() {
    if (!pendingReconciliation) return;

    const updated = await updateStatus(pendingReconciliation.id, "RECONCILED");
    if (!updated) return;

    setPendingReconciliation(null);
    await reloadCurrentPage();
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-primary/10">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal">
              Bank Reconciliation
            </h1>
            <p className="text-sm text-muted-foreground">
              Match bank statement balances against system-calculated balances.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {data.pagination.total.toLocaleString()} reconciliations
          </Badge>
          <Badge variant="outline">{draftCount} draft</Badge>
          <Badge>{reconciledCount} reconciled</Badge>
          <Badge variant={varianceCount > 0 ? "destructive" : "secondary"}>
            {varianceCount} variance
          </Badge>
        </div>
      </div>

      <Card className="rounded-md">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px] xl:max-w-5xl">
              <div className="grid gap-1.5">
                <Label htmlFor="reconciliationSearch">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reconciliationSearch"
                    value={search}
                    placeholder="Bank, status, or record id"
                    className="pl-9"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as ReconciliationStatus | "ALL");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item === "ALL" ? "All statuses" : item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label>Bank</Label>
                <Select
                  value={bankId}
                  onValueChange={(value) => {
                    setBankId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="All banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All banks</SelectItem>
                    {data.banks.map((bank) => (
                      <SelectItem key={bank.bankId} value={String(bank.bankId)}>
                        {bank.bankName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void reloadCurrentPage()}
              >
                <RefreshCw className={cn(loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" disabled={saving} onClick={openCreateDialog}>
                <Plus />
                New Reconciliation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <div className="mx-6 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Statement Date</TableHead>
                  <TableHead className="text-right">Statement</TableHead>
                  <TableHead className="text-right">System</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading reconciliations...
                    </TableCell>
                  </TableRow>
                ) : data.reconciliations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      No bank reconciliations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.reconciliations.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-64 truncate font-medium">
                        {item.bankLabel}
                      </TableCell>
                      <TableCell>{formatDate(item.statementDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.statementBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.systemBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={cn(
                            isZeroVariance(item.variance)
                              ? "text-emerald-700"
                              : "text-destructive",
                          )}
                        >
                          {formatMoney(item.variance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {item.status === "DRAFT" ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving || !isZeroVariance(item.variance)}
                              title={
                                isZeroVariance(item.variance)
                                  ? "Mark as reconciled"
                                  : "Resolve the variance before reconciling"
                              }
                              onClick={() => setPendingReconciliation(item)}
                            >
                              Reconcile
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No actions
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading reconciliations...
              </div>
            ) : data.reconciliations.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                No bank reconciliations found.
              </div>
            ) : (
              data.reconciliations.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.bankLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(item.statementDate)}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Statement</p>
                      <p className="tabular-nums">{formatMoney(item.statementBalance)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">System</p>
                      <p className="tabular-nums">{formatMoney(item.systemBalance)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p
                        className={cn(
                          "tabular-nums",
                          isZeroVariance(item.variance)
                            ? "text-emerald-700"
                            : "text-destructive",
                        )}
                      >
                        {formatMoney(item.variance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p>{formatDateTime(item.createdAt)}</p>
                    </div>
                  </div>
                  {item.status === "DRAFT" ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving || !isZeroVariance(item.variance)}
                        onClick={() => setPendingReconciliation(item)}
                      >
                        Reconcile
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {data.reconciliations.length} of{" "}
              {data.pagination.total.toLocaleString()} reconciliations
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    aria-disabled={page <= 1 || saving}
                    className={cn(
                      (page <= 1 || saving) && "pointer-events-none opacity-50",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!saving) setPage((current) => Math.max(1, current - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm tabular-nums text-muted-foreground">
                    {data.pagination.page} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    aria-disabled={page >= totalPages || saving}
                    className={cn(
                      (page >= totalPages || saving) &&
                        "pointer-events-none opacity-50",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!saving) {
                        setPage((current) => Math.min(totalPages, current + 1));
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden p-0">
          <form onSubmit={submitForm} className="flex min-h-0 max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b p-6 pb-4">
              <DialogTitle>New Bank Reconciliation</DialogTitle>
              <DialogDescription>
                The system balance and variance are calculated when the draft is created.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-6">
              {formError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid min-w-0 gap-1.5 md:col-span-2">
                  <Label>Bank Account *</Label>
                  <BankSelect
                    banks={data.banks}
                    value={formValues.bankId}
                    placeholder="Select bank account"
                    disabled={saving}
                    onValueChange={(value) => updateFormValue("bankId", value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="statementDate">Statement Date *</Label>
                  <Input
                    id="statementDate"
                    type="date"
                    value={formValues.statementDate}
                    disabled={saving}
                    onChange={(event) =>
                      updateFormValue("statementDate", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="statementBalance">Statement Balance *</Label>
                  <Input
                    id="statementBalance"
                    type="number"
                    step="0.01"
                    value={formValues.statementBalance}
                    disabled={saving}
                    onChange={(event) =>
                      updateFormValue("statementBalance", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-3 rounded-md border bg-muted/40 p-4 md:col-span-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">System Balance</p>
                      <p className="text-xs text-muted-foreground">
                        Calculated from recorded deposits, transfers, and disbursements.
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      {systemBalanceLoading ? (
                        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Calculating...
                        </p>
                      ) : systemBalancePreview ? (
                        <p className="text-lg font-semibold tabular-nums">
                          {formatMoney(systemBalancePreview.systemBalance)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a bank and statement date
                        </p>
                      )}
                    </div>
                  </div>
                  {systemBalanceError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {systemBalanceError}
                    </div>
                  ) : null}
                  {projectedVariance !== null ? (
                    <div className="flex flex-col gap-1 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Projected Variance
                      </p>
                      <p
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          isZeroVariance(projectedVariance)
                            ? "text-emerald-700"
                            : "text-destructive",
                        )}
                      >
                        {formatMoney(projectedVariance)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t p-6 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Create Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingReconciliation)}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingReconciliation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark reconciliation as reconciled?</AlertDialogTitle>
            <AlertDialogDescription>
              Reconciled records become the month-end match between the bank statement
              and system balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingReconciliation ? (
            <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{pendingReconciliation.bankLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Statement Date</span>
                <span>{formatDate(pendingReconciliation.statementDate)}</span>
                <span className="text-muted-foreground">Statement Balance</span>
                <span className="tabular-nums">
                  {formatMoney(pendingReconciliation.statementBalance)}
                </span>
                <span className="text-muted-foreground">System Balance</span>
                <span className="tabular-nums">
                  {formatMoney(pendingReconciliation.systemBalance)}
                </span>
                <span className="text-muted-foreground">Variance</span>
                <span className="tabular-nums">
                  {formatMoney(pendingReconciliation.variance)}
                </span>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep Draft</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void confirmReconcile();
              }}
            >
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Mark Reconciled
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
