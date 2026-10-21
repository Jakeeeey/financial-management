"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogisticsWerDispatchPlanDetail } from "../types";
import { dispatchPlanStatusClassName, displayWerStatus } from "../utils/status";
import { LogisticsWerPayablesSection } from "./LogisticsWerPayablesSection";
import { BudgetClassificationEditor } from "./BudgetClassificationEditor";
import { BudgetAllocationEditor } from "./BudgetAllocationEditor";

function formatMoney(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

interface LogisticsWerDetailsSheetProps {
  open: boolean;
  detail: LogisticsWerDispatchPlanDetail | null;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => Promise<void> | void;
}

export function LogisticsWerDetailsSheet({ open, detail, loading, error, onOpenChange, onChanged }: LogisticsWerDetailsSheetProps) {
  const payableSubmissions = detail?.submissions ?? [];
  const disbursementLineCount = payableSubmissions.reduce((total, submission) => total + submission.lineCount, 0);
  const totalDisbursements = payableSubmissions.reduce((total, submission) => total + submission.totalAmount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(96vw,1120px)] overflow-y-auto sm:max-w-[1120px]">
        <SheetHeader className="border-b px-6 pb-4">
          <SheetTitle>Logistics WER details</SheetTitle>
          <SheetDescription>
            {detail
              ? `Expense allocations and WER payable submissions for ${detail.plan.docNo}.`
              : "Loading dispatch plan details…"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 pb-8">
          {loading && !detail && (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading details…
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Unable to load dispatch plan</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {detail && (
            <>
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailValue label="Dispatch plan" value={detail.plan.docNo} strong />
                <DetailValue label="Estimated dispatch" value={formatDate(detail.plan.dispatchDate)} />
                <DetailValue
                  label="Driver / vehicle"
                  value={`${detail.plan.driverName || "Unassigned"} · ${detail.plan.vehicleName || "Unassigned"}`}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={dispatchPlanStatusClassName(detail.plan.status)}>
                    {displayWerStatus(detail.plan.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Dispatch Total Value" value={formatMoney(detail.plan.amount)} />
                <Metric
                  label="Disbursement Lines"
                  value={detail.budgetContextAvailable ? String(disbursementLineCount) : "Unavailable"}
                />
                <Metric
                  label="Total Disbursements"
                  value={detail.budgetContextAvailable ? formatMoney(totalDisbursements) : "Unavailable"}
                />
              </div>

              {detail.plan.remarks && (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="font-medium">Starting point:</span> {detail.plan.remarks}
                </div>
              )}

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">Expense budget by COA</h3>
                  <p className="text-xs text-muted-foreground">
                    WER submissions are reserved against the remaining amount for their own expense account.
                  </p>
                </div>
                {!detail.budgetContextAvailable ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Expense budget unavailable</AlertTitle>
                    <AlertDescription>
                      {detail.budgetContextError || "The budget and payable reservations could not be verified. New submissions are blocked."}
                    </AlertDescription>
                  </Alert>
                ) : detail.budgetBalancesByCoa.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No classified expense budgets are available for payable submissions.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Chart of Accounts</TableHead>
                          <TableHead className="text-right">Allocated</TableHead>
                          <TableHead className="text-right">Reserved</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="text-right">Over budget</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.budgetBalancesByCoa.map((balance) => {
                          const lines = detail.budgetLines.filter((line) => line.coaId === balance.coaId);
                          const label = lines[0]
                            ? `${lines[0].coaCode ? `${lines[0].coaCode} · ` : ""}${lines[0].coaTitle || `COA ${balance.coaId}`}`
                            : `COA ${balance.coaId}`;
                          return (
                            <TableRow key={balance.coaId}>
                              <TableCell>{label}</TableCell>
                              <TableCell className="text-right">{formatMoney(balance.allocatedAmount)}</TableCell>
                              <TableCell className="text-right">{formatMoney(balance.reservedAmount)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatMoney(balance.remainingAmount)}</TableCell>
                              <TableCell className="text-right text-destructive">
                                {balance.overBudgetAmount > 0 ? formatMoney(balance.overBudgetAmount) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {(detail.unclassifiedBudgetAmount ?? 0) > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {formatMoney(detail.unclassifiedBudgetAmount ?? 0)} is not available until its budget line is classified to a COA.
                  </p>
                )}
                {(detail.unclassifiedReservedAmount ?? 0) > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Unclassified active reservation</AlertTitle>
                    <AlertDescription>
                      {formatMoney(detail.unclassifiedReservedAmount ?? 0)} in submitted payables has no COA classification, so new submissions are blocked until it is resolved.
                    </AlertDescription>
                  </Alert>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Dispatch budget allocations</h3>
                    <p className="text-xs text-muted-foreground">
                      Set the expense allowance by account. Payable submissions are checked against each account&apos;s available balance.
                    </p>
                  </div>
                  <BudgetAllocationEditor
                    planId={detail.plan.id}
                    budgetLines={detail.budgetLines}
                    disabled={(detail.plan.status || "").toLowerCase() !== "for clearance" || detail.isLiquidated === true}
                    onSaved={() => onChanged?.()}
                  />
                </div>

                {detail.budgetLines.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    No budget lines were recorded for this dispatch plan.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead>Chart of Accounts</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead className="w-24 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.budgetLines.map((line, index) => {
                          const isClassified = Boolean(line.coaId && line.remarks?.trim());
                          return (
                            <TableRow key={line.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{line.remarks || "—"}</TableCell>
                              <TableCell>
                                {line.coaId
                                  ? `${line.coaCode ? `${line.coaCode} · ` : ""}${line.coaTitle || `COA ${line.coaId}`}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatMoney(line.amount)}</TableCell>
                              <TableCell>
                                <Badge variant={isClassified ? "secondary" : "outline"}>
                                  {isClassified ? "Classified" : "Needs classification"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <BudgetClassificationEditor
                                  planId={detail.plan.id}
                                  line={line}
                                  disabled={(detail.plan.status || "").toLowerCase() !== "for clearance" || detail.isLiquidated === true}
                                  onSaved={() => onChanged?.()}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <LogisticsWerPayablesSection
                planId={detail.plan.id}
                planStatus={detail.plan.status}
                detail={detail}
                onChanged={() => onChanged?.()}
              />

              {detail.stops.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Route details</h3>
                    <p className="text-xs text-muted-foreground">Documents and stops included in the dispatch approval.</p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sequence</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Stop</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.stops.map((stop, index) => (
                          <TableRow key={`${stop.documentNo || stop.name}-${stop.sequence ?? index}`}>
                            <TableCell>{stop.sequence ?? index + 1}</TableCell>
                            <TableCell><Badge variant="outline">{stop.type}</Badge></TableCell>
                            <TableCell>{stop.name}</TableCell>
                            <TableCell>{stop.documentNo || "—"}</TableCell>
                            <TableCell>{stop.status || "—"}</TableCell>
                            <TableCell className="text-right">{formatMoney(stop.documentAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {detail.staff.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold">Assigned staff</h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.staff.map((staff, index) => (
                      <Badge key={`${staff.userId ?? staff.name}-${index}`} variant="secondary">
                        {staff.name}{staff.role ? ` · ${staff.role}` : ""}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "font-semibold" : "font-medium"}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
