"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PAGE_SIZE, PERIOD_KEYS, PERIOD_LABELS } from "../constants";
import type { PaymentBody } from "../schemas";
import type { PaymentRow } from "../types";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { DateField } from "./DateField";
import { PaymentDetailDialog } from "./PaymentDetailDialog";
import { PaymentDialog } from "./PaymentDialog";
import { TablePager } from "./TablePager";

const COLUMN_COUNT = 7;

interface PaymentsTabProps {
  companyId: number;
  year: number;
  payments: PaymentRow[];
  isLoading: boolean;
  isSaving: boolean;
  onCreate: (body: PaymentBody) => Promise<void>;
  onUpdate: (id: number, body: PaymentBody) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function PaymentsTab({
  companyId,
  year,
  payments,
  isLoading,
  isSaving,
  onCreate,
  onUpdate,
  onDelete,
}: PaymentsTabProps) {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);
  const [viewing, setViewing] = useState<PaymentRow | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [formCode, setFormCode] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");

  // The input stays instant; the table follows the debounced value.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const formCodes = useMemo(
    () => Array.from(new Set(payments.map((payment) => payment.formCode))).sort((left, right) => left.localeCompare(right)),
    [payments],
  );

  const rows = useMemo(() => {
    const needle = search.toLowerCase();
    return payments.filter((payment) => {
      if (formCode !== "ALL" && payment.formCode !== formCode) return false;
      if (period !== "ALL" && payment.periodKey !== period) return false;
      if (paidFrom && payment.paidOn < paidFrom) return false;
      if (paidTo && payment.paidOn > paidTo) return false;
      if (!needle) return true;
      return [payment.formCode, payment.referenceNo, payment.remarks, PERIOD_LABELS[payment.periodKey]].some((value) =>
        (value ?? "").toLowerCase().includes(needle),
      );
    });
  }, [payments, formCode, period, paidFrom, paidTo, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dirty =
    query.trim() !== "" || formCode !== "ALL" || period !== "ALL" || paidFrom !== "" || paidTo !== "";
  const emptyMessage = dirty ? "No payment matches these filters." : `No payment is recorded for ${year}.`;

  function clearFilters() {
    setQuery("");
    setSearch("");
    setFormCode("ALL");
    setPeriod("ALL");
    setPaidFrom("");
    setPaidTo("");
    setPage(1);
  }

  return (
    <section
      aria-label="Tax payments"
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold">Payments</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatNumber(rows.length)} payment{rows.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatCurrency(rows.reduce((sum, payment) => sum + payment.amount, 0))} paid
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="min-h-11 md:min-h-0"
          >
            <Plus className="mr-2 size-4" />
            Record payment
          </Button>
        </div>
      </header>

      <div aria-label="Tax payment filters" className="border-b border-border/50 px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="payment-filter-search" className="text-[11px] font-medium text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="payment-filter-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Form code or reference no."
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Form</Label>
            <Select
              value={formCode}
              onValueChange={(value) => {
                setFormCode(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Form code filter">
                <SelectValue placeholder="All forms" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All forms</SelectItem>
                {formCodes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Period</Label>
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Period filter">
                <SelectValue placeholder="All periods" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All periods</SelectItem>
                {PERIOD_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {PERIOD_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-filter-paid-from" className="text-[11px] font-medium text-muted-foreground">
              Paid on from
            </Label>
            <DateField
              id="payment-filter-paid-from"
              value={paidFrom}
              maxDate={paidTo || undefined}
              onChange={(value) => {
                setPaidFrom(value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-filter-paid-to" className="text-[11px] font-medium text-muted-foreground">
              Paid on to
            </Label>
            <DateField
              id="payment-filter-paid-to"
              value={paidTo}
              minDate={paidFrom || undefined}
              onChange={(value) => {
                setPaidTo(value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-end">
            {dirty ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 size-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table aria-label="Tax payments">
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Paid on</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="min-w-[180px]">Reference</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((payment) => (
                <TableRow
                  key={payment.id}
                  tabIndex={0}
                  aria-label={`Open ${payment.formCode} payment`}
                  className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                  onClick={() => setViewing(payment)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setViewing(payment);
                  }}
                >
                  <TableCell className="font-medium tabular-nums">{payment.formCode}</TableCell>
                  <TableCell>{PERIOD_LABELS[payment.periodKey]}</TableCell>
                  <TableCell className="tabular-nums">{payment.paidOn}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    <span className="block max-w-[220px] truncate" title={payment.referenceNo ?? ""}>
                      {payment.referenceNo ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums" title={payment.createdBy ? `User ${payment.createdBy}` : ""}>
                    {payment.createdBy ? `#${payment.createdBy}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${payment.formCode} payment`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(payment);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${payment.formCode} payment`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleting(payment);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePager
        page={safePage}
        pageCount={pageCount}
        total={rows.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        className="border-t border-border/50 px-4 py-3"
      />

      <PaymentDetailDialog
        payment={viewing}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
      />

      <PaymentDialog
        open={dialogOpen}
        payment={editing}
        companyId={companyId}
        year={year}
        isSaving={isSaving}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        onSubmit={async (body) => {
          if (editing) {
            await onUpdate(editing.id, body);
          } else {
            await onCreate(body);
          }
          setPage(1);
        }}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        title="Delete this payment?"
        description={
          deleting
            ? `${deleting.formCode}, ${PERIOD_LABELS[deleting.periodKey]}, ${formatCurrency(deleting.amount)}. The change log keeps the deleted values.`
            : ""
        }
        isSaving={isSaving}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        onConfirm={async () => {
          if (deleting) await onDelete(deleting.id);
        }}
      />
    </section>
  );
}
