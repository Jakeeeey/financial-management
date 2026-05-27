// src/modules/financial-management/treasury/bank-management/bank-transfers/BankTransfersModule.tsx
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  ArrowLeftRight,
  Check,
  Clock3,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BankTransferDialog } from "./components/BankTransferDialog";
import { useBankTransfers } from "./hooks/useBankTransfers";
import { printBankTransferCheck } from "./utils/printBankTransferCheck";
import type {
  BankTransfer,
  BankTransferFormValues,
  TransferStatus,
} from "./types";

const PAGE_SIZE = 10;
const statuses: Array<TransferStatus | "ALL"> = [
  "ALL",
  "PREPARED",
  "PENDING",
  "COMPLETED",
  "CANCELLED",
];

type PendingStatusChange = {
  transfer: BankTransfer;
  status: TransferStatus;
} | null;

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

function statusBadgeVariant(status: TransferStatus) {
  if (status === "COMPLETED") return "default";
  if (status === "CANCELLED") return "destructive";
  if (status === "PENDING") return "secondary";
  return "outline";
}

function statusActions(status: TransferStatus) {
  if (status === "PREPARED") {
    return [
      { label: "Submit", status: "PENDING" as const },
      { label: "Cancel", status: "CANCELLED" as const },
    ];
  }
  if (status === "PENDING") {
    return [
      { label: "Complete", status: "COMPLETED" as const },
      { label: "Cancel", status: "CANCELLED" as const },
    ];
  }
  return [];
}

function displayText(value: string) {
  return value?.trim() || "N/A";
}

function isPrintableCheckTransfer(transfer: BankTransfer) {
  return (
    transfer.status !== "CANCELLED" &&
    (transfer.transactionTypeId === 4 ||
      transfer.transactionTypeName.trim().toUpperCase() === "CHECK")
  );
}

export default function BankTransfersModule() {
  const {
    data,
    loading,
    saving,
    error,
    loadTransfers,
    createTransfer,
    updateStatus,
  } = useBankTransfers();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TransferStatus | "ALL">("ALL");
  const [paymentMethodId, setPaymentMethodId] = useState("ALL");
  const [sourceBankId, setSourceBankId] = useState("ALL");
  const [destinationBankId, setDestinationBankId] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange>(null);

  const totalPages = Math.max(1, data.pagination.totalPages);
  const preparedCount = useMemo(
    () => data.transfers.filter((transfer) => transfer.status === "PREPARED").length,
    [data.transfers],
  );
  const pendingCount = useMemo(
    () => data.transfers.filter((transfer) => transfer.status === "PENDING").length,
    [data.transfers],
  );
  const completedCount = useMemo(
    () => data.transfers.filter((transfer) => transfer.status === "COMPLETED").length,
    [data.transfers],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransfers({
        page,
        pageSize: PAGE_SIZE,
        search,
        status,
        transactionTypeId:
          paymentMethodId === "ALL" ? null : Number(paymentMethodId),
        sourceBankId: sourceBankId === "ALL" ? null : Number(sourceBankId),
        destinationBankId:
          destinationBankId === "ALL" ? null : Number(destinationBankId),
        startDate,
        endDate,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    destinationBankId,
    endDate,
    loadTransfers,
    page,
    paymentMethodId,
    search,
    sourceBankId,
    startDate,
    status,
  ]);

  function openCreateDialog() {
    setDialogOpen(true);
  }

  async function reloadCurrentPage(nextPage = page) {
    await loadTransfers({
      page: nextPage,
      pageSize: PAGE_SIZE,
      search,
      status,
      transactionTypeId:
        paymentMethodId === "ALL" ? null : Number(paymentMethodId),
      sourceBankId: sourceBankId === "ALL" ? null : Number(sourceBankId),
      destinationBankId:
        destinationBankId === "ALL" ? null : Number(destinationBankId),
      startDate,
      endDate,
    });
  }

  async function handleCreateTransfer(values: BankTransferFormValues) {
    const saved = await createTransfer(values);
    if (!saved) return false;

    setPage(1);
    await reloadCurrentPage(1);
    return true;
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;

    const updated = await updateStatus(
      pendingStatus.transfer.transferId,
      pendingStatus.status,
    );
    if (!updated) return;

    setPendingStatus(null);
    await reloadCurrentPage();
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-primary/10">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal">Bank Transfers</h1>
            <p className="text-sm text-muted-foreground">
              Prepare and track internal transfers between company bank accounts.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{data.pagination.total.toLocaleString()} transfers</Badge>
          <Badge variant="outline">{preparedCount} prepared</Badge>
          <Badge variant="secondary">{pendingCount} pending</Badge>
          <Badge>{completedCount} completed</Badge>
        </div>
      </div>

      <Card className="rounded-md">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid w-full gap-3 md:grid-cols-[minmax(240px,1fr)_180px_240px] xl:max-w-5xl">
              <div className="grid gap-1.5">
                <Label htmlFor="transferSearch">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="transferSearch"
                    value={search}
                    placeholder="Transfer no., reference no., or remarks"
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
                    setStatus(value as TransferStatus | "ALL");
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
              <div className="grid gap-1.5">
                <Label>Payment Method</Label>
                <Select
                  value={paymentMethodId}
                  onValueChange={(value) => {
                    setPaymentMethodId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full min-w-[220px]">
                    <SelectValue placeholder="All payment methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All methods</SelectItem>
                    {data.paymentMethods.map((method) => (
                      <SelectItem key={method.methodId} value={String(method.methodId)}>
                        {method.methodName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Source Bank</Label>
                <Select
                  value={sourceBankId}
                  onValueChange={(value) => {
                    setSourceBankId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All source banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All source banks</SelectItem>
                    {data.banks.map((bank) => (
                      <SelectItem key={bank.bankId} value={String(bank.bankId)}>
                        {bank.bankName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Destination Bank</Label>
                <Select
                  value={destinationBankId}
                  onValueChange={(value) => {
                    setDestinationBankId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All destination banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All destination banks</SelectItem>
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
                New Transfer
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22%] whitespace-normal">Transfer</TableHead>
                  <TableHead className="w-[11%] whitespace-normal">Date</TableHead>
                  <TableHead className="w-[25%] whitespace-normal">Route</TableHead>
                  <TableHead className="w-[18%] whitespace-normal text-right">Amounts</TableHead>
                  <TableHead className="w-[11%] whitespace-normal">Status</TableHead>
                  <TableHead className="w-[13%] whitespace-normal text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading transfers...
                    </TableCell>
                  </TableRow>
                ) : data.transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      No bank transfers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.transfers.map((transfer) => {
                    const actions = statusActions(transfer.status);
                    const showPrintCheck = isPrintableCheckTransfer(transfer);

                    return (
                      <TableRow key={transfer.transferId}>
                        <TableCell className="min-w-0 whitespace-normal align-top">
                          <p className="break-all font-medium">{transfer.transferNo}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            Ref: {displayText(transfer.referenceNumber)}
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            {displayText(transfer.transactionTypeName)}
                          </p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            Remarks: {displayText(transfer.remarks)}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-normal align-top">
                          {formatDate(transfer.transferDate)}
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal align-top">
                          <p className="break-words font-medium">{transfer.sourceBankLabel}</p>
                          <p className="mt-1 text-xs text-muted-foreground">to</p>
                          <p className="break-words">{transfer.destinationBankLabel}</p>
                        </TableCell>
                        <TableCell className="whitespace-normal text-right align-top text-sm tabular-nums">
                          <p>{formatMoney(transfer.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            Fee: {formatMoney(transfer.transferFee)}
                          </p>
                          <p className="font-medium">
                            Outflow: {formatMoney(transfer.totalOutflow)}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-normal align-top">
                          <Badge variant={statusBadgeVariant(transfer.status)}>
                            {transfer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            {showPrintCheck ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={() => printBankTransferCheck(transfer)}
                              >
                                <Printer />
                                Print Check
                              </Button>
                            ) : null}
                            {actions.map((action) => (
                              <Button
                                key={action.status}
                                type="button"
                                size="sm"
                                variant={action.status === "CANCELLED" ? "outline" : "default"}
                                disabled={saving}
                                onClick={() => setPendingStatus({ transfer, status: action.status })}
                              >
                                {action.label}
                              </Button>
                            ))}
                            {actions.length === 0 && !showPrintCheck ? (
                              <span className="text-sm text-muted-foreground">No actions</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading transfers...
              </div>
            ) : data.transfers.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                No bank transfers found.
              </div>
            ) : (
              data.transfers.map((transfer) => {
                const actions = statusActions(transfer.status);
                const showPrintCheck = isPrintableCheckTransfer(transfer);

                return (
                  <div key={transfer.transferId} className="grid gap-3 rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{transfer.transferNo}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(transfer.transferDate)}
                        </p>
                      </div>
                      <Badge variant={statusBadgeVariant(transfer.status)}>
                        {transfer.status}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">Reference</p>
                          <p className="truncate">{displayText(transfer.referenceNumber)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="truncate">{displayText(transfer.transactionTypeName)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remarks</p>
                        <p className="break-words">{displayText(transfer.remarks)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Source</p>
                        <p className="truncate">{transfer.sourceBankLabel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Destination</p>
                        <p className="truncate">{transfer.destinationBankLabel}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="tabular-nums">{formatMoney(transfer.amount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fee</p>
                          <p className="tabular-nums">{formatMoney(transfer.transferFee)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outflow</p>
                          <p className="tabular-nums">{formatMoney(transfer.totalOutflow)}</p>
                        </div>
                      </div>
                    </div>
                    {actions.length > 0 || showPrintCheck ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {showPrintCheck ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => printBankTransferCheck(transfer)}
                          >
                            <Printer />
                            Print Check
                          </Button>
                        ) : null}
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            type="button"
                            size="sm"
                            variant={action.status === "CANCELLED" ? "outline" : "default"}
                            disabled={saving}
                            onClick={() => setPendingStatus({ transfer, status: action.status })}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {data.transfers.length} of {data.pagination.total.toLocaleString()} transfers
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    aria-disabled={page <= 1 || saving}
                    className={cn((page <= 1 || saving) && "pointer-events-none opacity-50")}
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
                    className={cn((page >= totalPages || saving) && "pointer-events-none opacity-50")}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!saving) setPage((current) => Math.min(totalPages, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <BankTransferDialog
        open={dialogOpen}
        banks={data.banks}
        paymentMethods={data.paymentMethods}
        saving={saving}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateTransfer}
      />

      <AlertDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus?.status === "COMPLETED"
                ? "Complete transfer?"
                : pendingStatus?.status === "CANCELLED"
                  ? "Cancel transfer?"
                  : "Submit transfer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus?.status === "COMPLETED"
                ? "Completed transfers will be included in the unified ledger as transfer out and transfer in entries."
                : pendingStatus?.status === "CANCELLED"
                  ? "Cancelled transfers are terminal and cannot be completed later."
                  : "Submitted transfers move from prepared to pending for completion."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingStatus ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{pendingStatus.transfer.transferNo}</p>
              <p className="text-muted-foreground">
                {pendingStatus.transfer.sourceBankName} to {pendingStatus.transfer.destinationBankName}
              </p>
              <p className="mt-1 tabular-nums">
                Outflow: {formatMoney(pendingStatus.transfer.totalOutflow)}
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep Current Status</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              variant={pendingStatus?.status === "CANCELLED" ? "destructive" : "default"}
              onClick={(event) => {
                event.preventDefault();
                void confirmStatusChange();
              }}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {pendingStatus?.status === "COMPLETED" ? (
                <>
                  <Check />
                  Complete
                </>
              ) : pendingStatus?.status === "CANCELLED" ? (
                <>
                  <XCircle />
                  Cancel Transfer
                </>
              ) : (
                <>
                  <Clock3 />
                  Submit
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
