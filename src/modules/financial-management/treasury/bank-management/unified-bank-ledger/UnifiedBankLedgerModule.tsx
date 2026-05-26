// src/modules/financial-management/treasury/bank-management/unified-bank-ledger/UnifiedBankLedgerModule.tsx
"use client";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUnifiedBankLedger } from "./hooks/useUnifiedBankLedger";
import type {
  LedgerEntryType,
  UnifiedBankLedgerBank,
  UnifiedBankLedgerEntry,
} from "./types";

const PAGE_SIZE = 10;

type BankSelectProps = {
  banks: UnifiedBankLedgerBank[];
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

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

function entryTypeLabel(type: LedgerEntryType) {
  switch (type) {
    case "OPENING_BALANCE":
      return "Opening";
    case "DEPOSIT":
      return "Deposit";
    case "TRANSFER_OUT":
      return "Transfer Out";
    case "TRANSFER_IN":
      return "Transfer In";
    case "DISBURSEMENT":
      return "Disbursement";
    default:
      return type;
  }
}

function entryBadgeVariant(type: LedgerEntryType) {
  if (type === "DISBURSEMENT") return "destructive";
  if (type === "TRANSFER_OUT") return "secondary";
  if (type === "OPENING_BALANCE") return "outline";
  return "default";
}

function amountTone(entry: UnifiedBankLedgerEntry) {
  if (entry.creditAmount > 0) return "text-emerald-700";
  if (entry.debitAmount > 0) return "text-destructive";
  return "text-muted-foreground";
}

function BankSelect({ banks, value, disabled, onValueChange }: BankSelectProps) {
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
            {selectedBank?.label || "Select bank account"}
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

export default function UnifiedBankLedgerModule() {
  const { data, loading, error, loadLedger } = useUnifiedBankLedger();
  const [page, setPage] = useState(1);
  const [bankId, setBankId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const selectedBankValue = bankId || String(data.selectedBankId ?? "");
  const totalPages = Math.max(1, data.pagination.totalPages);
  const selectedBank = useMemo(
    () =>
      data.banks.find((bank) => String(bank.bankId) === selectedBankValue) ??
      null,
    [data.banks, selectedBankValue],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLedger({
        bankId: bankId ? Number(bankId) : null,
        startDate,
        endDate,
        page,
        pageSize: PAGE_SIZE,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [bankId, endDate, loadLedger, page, startDate]);

  async function reloadCurrentPage(nextPage = page) {
    await loadLedger({
      bankId: bankId ? Number(bankId) : null,
      startDate,
      endDate,
      page: nextPage,
      pageSize: PAGE_SIZE,
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal">
              Unified Bank Ledger
            </h1>
            <p className="text-sm text-muted-foreground">
              Review money movement and running balances for company bank accounts.
            </p>
          </div>
        </div>
        <Badge variant="outline">
          {data.pagination.total.toLocaleString()} ledger entries
        </Badge>
      </div>

      <Card className="rounded-md">
        <CardHeader className="gap-3 border-b">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_auto] lg:items-end">
            <div className="grid min-w-0 gap-1.5">
              <Label>Bank Account</Label>
              <BankSelect
                banks={data.banks}
                value={selectedBankValue}
                disabled={loading && data.banks.length === 0}
                onValueChange={(value) => {
                  setBankId(value);
                  setPage(1);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ledgerStartDate">Start Date</Label>
              <Input
                id="ledgerStartDate"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ledgerEndDate">End Date</Label>
              <Input
                id="ledgerEndDate"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full lg:w-auto"
              onClick={() => void reloadCurrentPage()}
            >
              <RefreshCw className={cn(loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-md">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums">
              {formatMoney(data.summary.currentBalance)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-emerald-700" />
              Credits
            </p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums">
              {formatMoney(data.summary.totalCredits)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownLeft className="h-4 w-4 text-destructive" />
              Debits
            </p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums">
              {formatMoney(data.summary.totalDebits)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Selected Bank</p>
            <p className="mt-2 truncate text-lg font-semibold">
              {selectedBank?.bankName || "N/A"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {selectedBank?.accountNumber || "No account selected"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Ledger Entries</p>
              <p className="text-sm text-muted-foreground">
                Running balances are calculated chronologically and displayed newest first.
              </p>
            </div>
            <Badge variant="outline">
              {data.summary.entryCount.toLocaleString()} in range
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading ledger...
                    </TableCell>
                  </TableRow>
                ) : data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                      No ledger entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                      <TableCell>
                        <Badge variant={entryBadgeVariant(entry.transactionType)}>
                          {entryTypeLabel(entry.transactionType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate font-medium">
                        {entry.referenceNo}
                      </TableCell>
                      <TableCell className="max-w-64 truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.debitAmount > 0 ? formatMoney(entry.debitAmount) : "N/A"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.creditAmount > 0 ? formatMoney(entry.creditAmount) : "N/A"}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", amountTone(entry))}>
                        {formatMoney(entry.runningBalance)}
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
                Loading ledger...
              </div>
            ) : data.entries.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                No ledger entries found.
              </div>
            ) : (
              data.entries.map((entry) => (
                <div key={entry.id} className="grid gap-3 rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.referenceNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(entry.transactionDate)}
                      </p>
                    </div>
                    <Badge variant={entryBadgeVariant(entry.transactionType)}>
                      {entryTypeLabel(entry.transactionType)}
                    </Badge>
                  </div>
                  <p className="truncate text-sm">{entry.description}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Debit</p>
                      <p className="tabular-nums">
                        {entry.debitAmount > 0 ? formatMoney(entry.debitAmount) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Credit</p>
                      <p className="tabular-nums">
                        {entry.creditAmount > 0 ? formatMoney(entry.creditAmount) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Balance</p>
                      <p className={cn("tabular-nums", amountTone(entry))}>
                        {formatMoney(entry.runningBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {data.entries.length} of{" "}
              {data.pagination.total.toLocaleString()} entries
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    aria-disabled={page <= 1}
                    className={cn(page <= 1 && "pointer-events-none opacity-50")}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
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
                    aria-disabled={page >= totalPages}
                    className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(totalPages, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
