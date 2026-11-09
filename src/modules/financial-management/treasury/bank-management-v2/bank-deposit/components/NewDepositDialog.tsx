"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { phtDate, toPhtDateString } from "../pht";
import { DepositPreview } from "./DepositPreview";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import type { DepositAccountOption } from "../providers/depositApi";
import type { UndepositedAsset } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: DepositAccountOption[];
  assets: UndepositedAsset[];
  isSaving: boolean;
  onSubmit: (payload: {
    bankAccountId: number;
    depositDate: string;
    slipNo: string;
    remarks: string | null;
    cashIds: number[];
    checkIds: number[];
  }) => Promise<unknown>;
};

/**
 * Deposit slip creation. The FSD validates slip number uniqueness per account on the
 * server; this dialog only enforces what it can see (required fields, not a future date).
 */
export function NewDepositDialog({ open, onOpenChange, accounts, assets, isSaving, onSubmit }: Props) {
  const today = phtDate();
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [depositDate, setDepositDate] = useState(today);
  const [slipNo, setSlipNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [touched, setTouched] = useState(false);

  const totals = useMemo(() => {
    const cash = assets.filter((asset) => asset.assetType === "CASH").reduce((sum, asset) => sum + asset.amount, 0);
    const checks = assets.filter((asset) => asset.assetType === "CHECK").reduce((sum, asset) => sum + asset.amount, 0);
    return { cash, checks, total: cash + checks };
  }, [assets]);
  const cashCount = assets.filter((asset) => asset.assetType === "CASH").length;
  const checkCount = assets.length - cashCount;

  const accountOptions = accounts.map((account) => ({ value: String(account.bankId), label: account.label }));

  const errors = {
    bankAccountId: bankAccountId ? "" : "Choose the account being deposited into.",
    depositDate: depositDate ? (depositDate > today ? "The deposit date cannot be in the future." : "") : "Pick the deposit date.",
    slipNo: slipNo.trim() ? "" : "Enter the slip or validation number.",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (hasErrors || assets.length === 0) return;

    const result = await onSubmit({
      bankAccountId: Number(bankAccountId),
      depositDate,
      slipNo: slipNo.trim(),
      remarks: remarks.trim() || null,
      cashIds: assets.filter((asset) => asset.assetType === "CASH").map((asset) => asset.collectionDetailId),
      checkIds: assets.filter((asset) => asset.assetType === "CHECK").map((asset) => asset.collectionDetailId),
    });
    if (result) {
      setSlipNo("");
      setRemarks("");
      setTouched(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] p-0 sm:max-w-[950px] rounded-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">
              Deposit {assets.length} collection{assets.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              Total {formatCurrency(totals.total)} · {cashCount} cash, {checkCount} check
              {checkCount === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-account">
                    Deposit to bank account <span className="text-destructive">*</span>
                  </Label>
                  <OptionCombobox
                    id="deposit-account"
                    options={accountOptions}
                    value={bankAccountId}
                    onChange={setBankAccountId}
                    placeholder="Select account"
                    searchPlaceholder="Search bank accounts"
                    emptyLabel="No account matches that search."
                  />
                  {touched && errors.bankAccountId && (
                    <p className="text-xs text-destructive">{errors.bankAccountId}</p>
                  )}
                </div>

                <div className="grid items-end gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deposit-date" className="whitespace-nowrap">
                      Deposit date <span className="text-destructive">*</span>
                    </Label>
                    <DateField
                      id="deposit-date"
                      inDialog
                      maxDate={today}
                      value={depositDate}
                      onChange={(value) => setDepositDate(value)}
                    />
                    {touched && errors.depositDate && (
                      <p className="text-xs text-destructive">{errors.depositDate}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit-slip-no" className="whitespace-nowrap">
                      Slip / validation no. <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="deposit-slip-no"
                      value={slipNo}
                      maxLength={40}
                      placeholder="As printed or validated by the bank"
                      onChange={(event) => setSlipNo(event.target.value)}
                    />
                    {touched && errors.slipNo && <p className="text-xs text-destructive">{errors.slipNo}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deposit-remarks">Remarks</Label>
                  <Textarea
                    id="deposit-remarks"
                    rows={3}
                    maxLength={500}
                    className="min-h-[92px] resize-none"
                    placeholder="Optional, e.g. deposited by armored car"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <DepositPreview
                  bankAccountId={bankAccountId ? Number(bankAccountId) : null}
                  cashTotal={totals.cash}
                />
                {checkCount > 0 ? (
                  <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                    {checkCount} check{checkCount === 1 ? "" : "s"} totalling {formatCurrency(totals.checks)} move to
                    In Clearing. No entry is posted for them now; the bank GL is debited when each check clears.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Deposit slip contents</p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Type</TableHead>
                      <TableHead className="max-w-[140px]">Reference</TableHead>
                      <TableHead className="max-w-[160px]">Customer</TableHead>
                      <TableHead className="w-[120px]">Collected</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.collectionDetailId}>
                        <TableCell className="text-sm">{asset.assetType === "CASH" ? "Cash" : "Check"}</TableCell>
                        <TableCell className="max-w-[140px]">
                          <p className="truncate font-mono text-sm" title={asset.documentNumber}>
                            {asset.documentNumber}
                          </p>
                          {asset.checkNo ? (
                            <p className="truncate text-[11px] text-muted-foreground">Check {asset.checkNo}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm" title={asset.customer ?? undefined}>
                          {asset.customer ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {asset.collectionDate ? toPhtDateString(asset.collectionDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(asset.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground">
                        Cash {formatCurrency(totals.cash)} · Checks {formatCurrency(totals.checks)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving || assets.length === 0}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save slip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
