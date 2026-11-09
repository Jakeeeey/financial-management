"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

import { DIRECTION_LABELS, PERIOD_LABELS, WITHHOLDING_LABELS, certificateStatusLabel } from "../constants";
import type { CertificateRow } from "../types";
import { StatusBadge } from "./StatusBadge";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual entry",
  SALES_INVOICE: "Sales invoice",
  PURCHASE_ORDER: "Purchase order",
};

function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Read-only view of one 2307 certificate; editing lives in CertificateDialog. */
function Missing() {
  return <span className="text-muted-foreground">not recorded</span>;
}

function recordedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDateTime(date);
}

interface Props {
  certificate: CertificateRow | null;
  onOpenChange: (open: boolean) => void;
}

export function CertificateDetailDialog({ certificate, onOpenChange }: Props) {
  return (
    <Dialog open={certificate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[700px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle className="pr-8 text-base">
              {certificate ? certificate.counterpartyName : "Certificate"}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {certificate ? (
                <>
                  <span className="tabular-nums">{certificate.counterpartyTin ?? "No TIN"}</span>
                  <span aria-hidden>·</span>
                  <span>{DIRECTION_LABELS[certificate.direction]}</span>
                  <span aria-hidden>·</span>
                  <span>{PERIOD_LABELS[certificate.periodKey]}</span>
                  <StatusBadge
                    status={certificate.status}
                    label={certificateStatusLabel(certificate.status)}
                    className="ml-1"
                  />
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {certificate ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Period">{PERIOD_LABELS[certificate.periodKey]}</Detail>
                <Detail label="Income type">{WITHHOLDING_LABELS[certificate.incomeType]}</Detail>
                <Detail label="Income" className="tabular-nums">
                  {formatCurrency(certificate.incomeAmount)}
                </Detail>
                <Detail label="Rate" className="tabular-nums">
                  {formatNumber(certificate.taxRate, "en-PH", 2)}%
                </Detail>
                <Detail label="Withheld" className="tabular-nums font-semibold">
                  {formatCurrency(certificate.taxWithheld)}
                </Detail>
                <Detail label="Date received" className="tabular-nums">
                  {certificate.dateReceived ?? <Missing />}
                </Detail>
                <Detail label="Matched status">
                  <StatusBadge status={certificate.status} label={certificateStatusLabel(certificate.status)} />
                </Detail>
                <Detail label="Source">{SOURCE_LABELS[certificate.source] ?? certificate.source}</Detail>
                <Detail label="Reference" className="tabular-nums">
                  {certificate.sourceRef ?? <Missing />}
                </Detail>
                <Detail label="Recorded" className="tabular-nums">
                  {recordedAt(certificate.createdAt)}
                </Detail>
                {certificate.remarks ? (
                  <Detail label="Remarks" className="col-span-2 sm:col-span-3">
                    {certificate.remarks}
                  </Detail>
                ) : null}
              </dl>
            </div>
          ) : null}

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
