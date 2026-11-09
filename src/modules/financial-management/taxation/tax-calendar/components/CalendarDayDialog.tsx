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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { formatLongDate } from "./calendarDates";
import { StatusBadge } from "./StatusBadge";
import { holidaysFor, nonWorkingReason } from "../services/holidays";
import type { CalendarDayItem } from "../types";

/** Every filing due on one day, with why that day is or is not a working day. */
export function CalendarDayDialog({
  date,
  items,
  onOpenChange,
}: {
  date: string | null;
  items: CalendarDayItem[];
  onOpenChange: (open: boolean) => void;
}) {
  const reason = date ? nonWorkingReason(date, holidaysFor(Number(date.slice(0, 4)))) : null;

  return (
    <Dialog open={date !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="tabular-nums">{date ? formatLongDate(date) : ""}</DialogTitle>
            <DialogDescription className="space-y-0.5">
              <span className="block tabular-nums">
                {items.length} obligation{items.length === 1 ? "" : "s"}
              </span>
              <span className="block">{reason ? `Not a working day: ${reason.toLowerCase()}.` : "A working day."}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Form</TableHead>
                  <TableHead className="w-[130px]">Period</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="w-[130px] text-right">Amount</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.formCode}-${item.period}-${item.companyName}`}>
                    <TableCell className="font-medium">
                      {item.formCode}
                      {item.movedFrom ? (
                        <span className="block text-[11px] text-muted-foreground">from {item.movedFrom}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.period}</TableCell>
                    <TableCell>
                      <span className="block max-w-[200px] truncate" title={item.companyName}>
                        {item.companyName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.amount === null ? "—" : formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
