"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { phtDate, toPhtDateString } from "../pht";
import { DateField } from "./DateField";
import type { BankCheck } from "../types";

type Props = {
  checks: BankCheck[];
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entries: { checkId: number; clearedDate: string }[]) => Promise<unknown>;
};

/**
 * Clearing in bulk: the bank statement dates differ per check, so each row carries
 * its own clearing date; "Apply to all" is the shortcut for a single statement day.
 */
export function BatchClearDialog({ checks, open, isSaving, onOpenChange, onSubmit }: Props) {
  const today = phtDate();
  const [sameDate, setSameDate] = useState(today);
  const [dates, setDates] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSameDate(today);
      setDates({});
      setTouched(false);
    }
    onOpenChange(next);
  }

  const dateFor = (check: BankCheck) => dates[check.id] ?? sameDate;
  const problems = checks.filter((check) => {
    const value = dateFor(check);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
    if (value > today) return true;
    return check.checkDate.length >= 10 && value < check.checkDate.slice(0, 10);
  });
  const total = checks.reduce((sum, check) => sum + check.amount, 0);

  async function handleSubmit() {
    setTouched(true);
    if (problems.length > 0) return;
    const saved = await onSubmit(checks.map((check) => ({ checkId: check.id, clearedDate: dateFor(check) })));
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[900px]">
        <div className="flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">
              Confirm cleared by bank: {checks.length} {checks.length === 1 ? "check" : "checks"}
            </DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-2xl">
              The date the bank shows each check paid (issued) or credited (received). This moves the amount out of GL
              232100 into the bank GL.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,220px)_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="batch-clear-date" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Same date for all
                </Label>
                <DateField
                  id="batch-clear-date"
                  inDialog
                  value={sameDate}
                  maxDate={today}
                  onChange={(value) => setSameDate(value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDates(Object.fromEntries(checks.map((check) => [check.id, sameDate])))}
              >
                Apply to all
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Check no.</TableHead>
                    <TableHead className="w-[100px]">Direction</TableHead>
                    <TableHead className="max-w-[160px]">Account</TableHead>
                    <TableHead className="max-w-[180px]">Payee / customer</TableHead>
                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                    <TableHead className="w-[110px]">Check date</TableHead>
                    <TableHead className="w-[170px]">
                      Clearing date <span className="text-destructive">*</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((check) => {
                    const value = dateFor(check);
                    const invalid = problems.includes(check);
                    return (
                      <TableRow key={check.id}>
                        <TableCell className="text-sm">
                          <span className="block truncate" title={check.checkNo}>
                            {check.checkNo}
                          </span>
                          {check.draweeBank ? (
                            <span className="block truncate text-xs text-muted-foreground">{check.draweeBank}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{check.direction === "ISSUED" ? "Issued" : "Received"}</TableCell>
                        <TableCell className="max-w-[160px] text-sm">
                          <span className="block truncate" title={check.bankAccountLabel}>
                            {check.bankAccountLabel}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[180px] text-sm">
                          <span className="block truncate" title={check.payee ?? check.payor ?? undefined}>
                            {check.payee ?? check.payor ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(check.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{toPhtDateString(check.checkDate)}</TableCell>
                        <TableCell>
                          <DateField
                            inDialog
                            aria-label={`Clearing date for check ${check.checkNo}`}
                            aria-invalid={invalid && touched ? true : undefined}
                            value={value}
                            minDate={check.checkDate.slice(0, 10)}
                            maxDate={today}
                            onChange={(next) => setDates((current) => ({ ...current, [check.id]: next }))}
                            className={invalid && touched ? "border-destructive" : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm font-medium">
                      {checks.length} check(s)
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrency(total)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {touched && problems.length > 0 ? (
              <p className="text-sm text-destructive">
                {problems.length} date(s) need fixing: not in the future, and not before the check date. Nothing was saved.
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={isSaving} onClick={handleSubmit}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear {checks.length} {checks.length === 1 ? "check" : "checks"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
