"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { phtDateLabel, phtToday } from "../pht";
import { OptionCombobox } from "./OptionCombobox";
import type { CheckbookSeries } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { bankId: number; label: string }[];
  isSaving: boolean;
  loadSeries: () => Promise<{ series: CheckbookSeries[]; notice?: string } | null>;
  onRegister: (payload: { bankAccountId: number; seriesStart: string; seriesEnd: string }) => Promise<unknown>;
};

/**
 * Checkbook series (FSD 1.4): binds a range of leaf numbers to one account so issuing a
 * check can take the next leaf. Overlaps are refused server-side.
 */
export function CheckbookDialog({ open, onOpenChange, accounts, isSaving, loadSeries, onRegister }: Props) {
  const [series, setSeries] = useState<CheckbookSeries[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [seriesStart, setSeriesStart] = useState("");
  const [seriesEnd, setSeriesEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadSeries().then((result) => {
      if (cancelled) return;
      setSeries(result?.series ?? []);
      setNotice(result?.notice ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loadSeries]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setBankAccountId("");
      setSeriesStart("");
      setSeriesEnd("");
      setError(null);
      setLoaded(false);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const start = Number(seriesStart);
    const end = Number(seriesEnd);
    if (!bankAccountId) return setError("Choose the account this checkbook belongs to.");
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0) {
      return setError("Check numbers must be whole numbers.");
    }
    if (end <= start) return setError("The end number must be greater than the start.");

    const result = await onRegister({ bankAccountId: Number(bankAccountId), seriesStart: String(start), seriesEnd: String(end) });
    if (result) {
      setSeriesStart("");
      setSeriesEnd("");
      const refreshed = await loadSeries();
      setSeries(refreshed?.series ?? []);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] p-0 sm:max-w-[760px] rounded-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Checkbook series</DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-lg">
              Bind a range of check numbers to one active checking account. Overlapping ranges are refused.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-end">
              <div className="space-y-2">
                <Label htmlFor="cb-account">
                  Account <span className="text-destructive">*</span>
                </Label>
                <OptionCombobox
                  id="cb-account"
                  options={accounts.map((account) => ({ value: String(account.bankId), label: account.label }))}
                  value={bankAccountId}
                  onChange={setBankAccountId}
                  placeholder="Select account"
                  searchPlaceholder="Search accounts"
                  emptyLabel="No account matches that search."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-start" className="whitespace-nowrap">
                  Start check no. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cb-start"
                  inputMode="numeric"
                  value={seriesStart}
                  placeholder="e.g. 900001"
                  onChange={(event) => setSeriesStart(event.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-end" className="whitespace-nowrap">
                  End check no. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cb-end"
                  inputMode="numeric"
                  value={seriesEnd}
                  placeholder="e.g. 900100"
                  onChange={(event) => setSeriesEnd(event.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription className="break-words">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Registered series</h3>
              {!loaded ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : notice ? (
                <Alert>
                  <AlertDescription className="break-words">{notice}</AlertDescription>
                </Alert>
              ) : series.length === 0 ? (
                <p className="rounded-lg border border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  No checkbook series yet. Until one exists, issuing a check has no check number to take.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[90px]">Series</TableHead>
                        <TableHead className="max-w-[240px]">Account</TableHead>
                        <TableHead className="w-[170px]">Range</TableHead>
                        <TableHead className="w-[120px]">Next check no.</TableHead>
                        <TableHead className="w-[110px] text-right">Remaining</TableHead>
                        <TableHead className="w-[130px]">Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {series.map((entry) => {
                        const start = Number(entry.seriesStart);
                        const end = Number(entry.seriesEnd);
                        const next = entry.nextNo ? Number(entry.nextNo) : start;
                        const remaining = Number.isFinite(end) ? Math.max(0, end - next + 1) : 0;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm tabular-nums">CB-{String(entry.id).padStart(2, "0")}</TableCell>
                            <TableCell className="max-w-[240px] truncate text-sm" title={entry.bankAccountLabel}>
                              {entry.bankAccountLabel}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm tabular-nums">
                              {entry.seriesStart}–{entry.seriesEnd}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm tabular-nums">
                              {remaining === 0 ? "Exhausted" : entry.nextNo ?? entry.seriesStart}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{remaining}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{phtDateLabel(entry.createdAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Today is {phtDateLabel(phtToday())}. A series must belong to the account the checks are drawn on.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={isSaving || !bankAccountId || !seriesStart || !seriesEnd}>
              Register series
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
