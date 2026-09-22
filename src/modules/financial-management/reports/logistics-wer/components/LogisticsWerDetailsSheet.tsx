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
import { WerWorkflowStepper, werStageForSubmissions } from "./WerWorkflowStepper";

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
  detail: LogisticsWerDispatchPlanDetail | null;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => Promise<void> | void;
}

export function LogisticsWerDetailsSheet({ detail, loading, error, onOpenChange, onChanged }: LogisticsWerDetailsSheetProps) {
  return (
    <Sheet open={loading || Boolean(detail)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(96vw,1120px)] overflow-y-auto sm:max-w-[1120px]">
        <SheetHeader className="border-b px-6 pb-4">
          <SheetTitle>Logistics WER details</SheetTitle>
          <SheetDescription>
            {detail
              ? `Disbursement lines recorded for ${detail.plan.docNo}.`
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

              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Planned amount" value={formatMoney(detail.plan.amount)} />
                <Metric label="Disbursement lines" value={String(detail.disbursements.length)} />
                <Metric label="Recorded disbursements" value={formatMoney(detail.disbursementTotal)} />
                <Metric label="Route stops" value={String(detail.stops.length)} />
              </div>

              {detail.plan.remarks && (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="font-medium">Starting point:</span> {detail.plan.remarks}
                </div>
              )}

              <WerWorkflowStepper
                currentStage={werStageForSubmissions(detail.submissions, detail.isLiquidated)}
              />

              <LogisticsWerPayablesSection
                planId={detail.plan.id}
                planStatus={detail.plan.status}
                detail={detail}
                onChanged={() => onChanged?.()}
              />

              <section className="space-y-3">
                <div>
                  <h3 className="font-semibold">Dispatch disbursements</h3>
                  <p className="text-xs text-muted-foreground">
                    These lines come from the dispatch-approval detail response for this plan.
                  </p>
                </div>

                {detail.disbursements.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    No disbursement lines were recorded for this dispatch plan.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.disbursements.map((disbursement, index) => (
                          <TableRow key={disbursement.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{disbursement.remarks || "—"}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(disbursement.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

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
