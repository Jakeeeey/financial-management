"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, User, Briefcase, Wallet, Calendar, AlertCircle } from "lucide-react";

import type { SalesInvoiceMonitoringRow } from "../types";
import { formatAmount, formatDate } from "../utils";

interface SalesInvoiceMonitoringViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SalesInvoiceMonitoringRow | null;
}

export function SalesInvoiceMonitoringViewDialog({
  open,
  onOpenChange,
  row,
}: SalesInvoiceMonitoringViewDialogProps) {
  const actualOpen = open && Boolean(row);

  return (
    <Dialog open={actualOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Invoice Details
          </DialogTitle>
          <DialogDescription>
            {row?.invoiceNo ? `Viewing detailed information for Invoice #${row.invoiceNo}` : "View details for the selected invoice."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* General Info Card */}
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <User className="h-3.5 w-3.5" />
                Customer Name
              </div>
              <div className="font-semibold text-foreground text-base">{row?.customerName ?? "—"}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  Invoice No
                </div>
                <div className="font-medium text-sm">{row?.invoiceNo ?? "—"}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Briefcase className="h-3.5 w-3.5" />
                  Salesman
                </div>
                <div className="font-medium text-sm">{row?.salesman ?? "—"}</div>
              </div>
            </div>
          </div>

          {/* Financial & Status Card */}
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Wallet className="h-3.5 w-3.5" />
                Amount
              </div>
              <div className="text-2xl font-bold tracking-tight text-primary">
                {row ? `₱${formatAmount(row.amount)}` : "—"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" />
                  Delivery Date
                </div>
                <div className="font-medium text-sm">{row ? formatDate(row.deliveryDate) : "—"}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Days Lapses
                </div>
                <div className="flex items-center">
                  {row ? (
                    <Badge 
                      variant={row.daysLapses > 30 ? "destructive" : row.daysLapses > 0 ? "secondary" : "default"}
                      className="px-2 py-0.5 text-xs font-semibold"
                    >
                      {row.daysLapses} {row.daysLapses === 1 ? 'Day' : 'Days'}
                    </Badge>
                  ) : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
