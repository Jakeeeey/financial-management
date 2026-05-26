"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import type {
  BankTransferBank,
  BankTransferFormValues,
  BankTransferPaymentMethod,
} from "../types";

type BankTransferDialogProps = {
  open: boolean;
  banks: BankTransferBank[];
  paymentMethods: BankTransferPaymentMethod[];
  saving: boolean;
  initialValues?: Partial<BankTransferFormValues>;
  lockedSourceBankId?: string;
  sourceCurrentBalance?: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BankTransferFormValues) => Promise<boolean>;
};

type BankSelectProps = {
  banks: BankTransferBank[];
  value: string;
  placeholder: string;
  disabled?: boolean;
  excludeBankId?: string;
  onValueChange: (value: string) => void;
};

type PaymentMethodSelectProps = {
  paymentMethods: BankTransferPaymentMethod[];
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

type BankTransferFormProps = Omit<BankTransferDialogProps, "open">;

const emptyForm: BankTransferFormValues = {
  transferDate: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
  transactionTypeId: "",
  sourceBankId: "",
  destinationBankId: "",
  amount: "",
  transferFee: "0.00",
  remarks: "",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatAmountInput(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function validateForm(
  values: BankTransferFormValues,
  sourceCurrentBalance?: number,
) {
  const amount = Number(values.amount);
  const transferFee = Number(values.transferFee || 0);
  const totalOutflow = Math.round((amount + transferFee) * 100) / 100;

  if (!values.transferDate) return "Transfer date is required";
  if (!values.referenceNumber.trim()) return "Reference number is required";
  if (!/^[A-Za-z0-9]+$/.test(values.referenceNumber.trim())) {
    return "Reference number must contain letters and numbers only";
  }
  if (values.referenceNumber.trim().length > 50) {
    return "Reference number must be 50 characters or fewer";
  }
  if (!values.transactionTypeId) return "Transaction type is required";
  if (!values.sourceBankId) return "Source bank is required";
  if (!values.destinationBankId) return "Destination bank is required";
  if (values.sourceBankId === values.destinationBankId) {
    return "Source and destination banks must be different";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Amount must be greater than zero";
  }
  if (!Number.isFinite(transferFee) || transferFee < 0) {
    return "Transfer fee cannot be negative";
  }
  if (sourceCurrentBalance !== undefined && sourceCurrentBalance < 0) {
    return "This source bank has a negative current balance and cannot transfer funds";
  }
  if (
    sourceCurrentBalance !== undefined &&
    totalOutflow > Math.round(sourceCurrentBalance * 100) / 100
  ) {
    return "Total cash outflow cannot exceed the source bank current balance";
  }
  return null;
}

function buildInitialValues(
  initialValues?: Partial<BankTransferFormValues>,
  lockedSourceBankId?: string,
) {
  return {
    ...emptyForm,
    transferDate: new Date().toISOString().slice(0, 10),
    ...initialValues,
    sourceBankId: lockedSourceBankId ?? initialValues?.sourceBankId ?? "",
  };
}

function BankSelect({
  banks,
  value,
  placeholder,
  disabled,
  excludeBankId,
  onValueChange,
}: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedBank = banks.find((bank) => String(bank.bankId) === value);
  const visibleBanks = banks.filter((bank) => String(bank.bankId) !== excludeBankId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedBank?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search bank..." />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No banks found.</CommandEmpty>
            <CommandGroup>
              {visibleBanks.map((bank) => (
                <CommandItem
                  key={bank.bankId}
                  value={bank.label}
                  onSelect={() => {
                    onValueChange(String(bank.bankId));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(bank.bankId) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{bank.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PaymentMethodSelect({
  paymentMethods,
  value,
  disabled,
  onValueChange,
}: PaymentMethodSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedMethod = paymentMethods.find(
    (method) => String(method.methodId) === value,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedMethod?.methodName || "Select transaction type"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search transaction type..." />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No transaction types found.</CommandEmpty>
            <CommandGroup>
              {paymentMethods.map((method) => (
                <CommandItem
                  key={method.methodId}
                  value={method.methodName}
                  onSelect={() => {
                    onValueChange(String(method.methodId));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(method.methodId)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{method.methodName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function BankTransferDialog({
  open,
  saving,
  onOpenChange,
  ...formProps
}: BankTransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}>
      {open ? (
        <BankTransferForm
          saving={saving}
          onOpenChange={onOpenChange}
          {...formProps}
        />
      ) : null}
    </Dialog>
  );
}

function BankTransferForm({
  banks,
  paymentMethods,
  saving,
  initialValues,
  lockedSourceBankId,
  sourceCurrentBalance,
  onOpenChange,
  onSubmit,
}: BankTransferFormProps) {
  const [formValues, setFormValues] = useState<BankTransferFormValues>(
    buildInitialValues(initialValues, lockedSourceBankId),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const sourceLocked = Boolean(lockedSourceBankId);
  const selectedSourceBank = banks.find(
    (bank) => String(bank.bankId) === formValues.sourceBankId,
  );
  const effectiveSourceCurrentBalance =
    sourceCurrentBalance ?? selectedSourceBank?.currentBalance;
  const sourceBalanceIsNegative =
    effectiveSourceCurrentBalance !== undefined &&
    effectiveSourceCurrentBalance < 0;

  function updateFormValue(id: keyof BankTransferFormValues, value: string) {
    setFormError(null);
    setFormValues((current) => {
      const nextValues: BankTransferFormValues = {
        ...current,
        [id]: value,
        ...(id === "sourceBankId" && value === current.destinationBankId
          ? { destinationBankId: "" }
          : {}),
        ...(id === "destinationBankId" && value === current.sourceBankId
          ? { sourceBankId: "" }
          : {}),
      };

      if (id === "sourceBankId") {
        const nextSourceBank = banks.find((bank) => String(bank.bankId) === value);
        if (nextSourceBank?.currentBalance !== undefined) {
          nextValues.amount =
            nextSourceBank.currentBalance >= 0
              ? formatAmountInput(nextSourceBank.currentBalance)
              : "";
        }
      }

      return nextValues;
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(
      formValues,
      effectiveSourceCurrentBalance,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const saved = await onSubmit(formValues);
    if (saved) onOpenChange(false);
  }

  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col overflow-hidden p-0">
      <form onSubmit={submitForm} className="flex min-h-0 max-h-[calc(100vh-2rem)] flex-col">
        <DialogHeader className="shrink-0 border-b p-6 pb-4">
          <DialogTitle>New Bank Transfer</DialogTitle>
          <DialogDescription>
            Prepare an internal transfer. Ledger balances update only when the transfer is completed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-6">
          {formError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}
          {effectiveSourceCurrentBalance !== undefined ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                sourceBalanceIsNegative
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "bg-muted/40",
              )}
            >
              Source current balance:{" "}
              <span className="font-semibold tabular-nums">
                {formatMoney(effectiveSourceCurrentBalance)}
              </span>
              {sourceBalanceIsNegative ? (
                <span className="block text-xs">
                  This source bank cannot be used for a transfer.
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="transferDate">Transfer Date *</Label>
              <Input
                id="transferDate"
                type="date"
                value={formValues.transferDate}
                disabled={saving}
                onChange={(event) => updateFormValue("transferDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="referenceNumber">Reference Number *</Label>
              <Input
                id="referenceNumber"
                value={formValues.referenceNumber}
                maxLength={50}
                disabled={saving}
                placeholder="ABC123"
                onChange={(event) => updateFormValue("referenceNumber", event.target.value)}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Transaction Type *</Label>
              <PaymentMethodSelect
                paymentMethods={paymentMethods}
                value={formValues.transactionTypeId}
                disabled={saving}
                onValueChange={(value) => updateFormValue("transactionTypeId", value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formValues.amount}
                disabled={saving}
                onChange={(event) => updateFormValue("amount", event.target.value)}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Source Bank *</Label>
              <BankSelect
                banks={banks}
                value={formValues.sourceBankId}
                placeholder="Select source bank"
                disabled={saving || sourceLocked}
                excludeBankId={formValues.destinationBankId}
                onValueChange={(value) => updateFormValue("sourceBankId", value)}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Destination Bank *</Label>
              <BankSelect
                banks={banks}
                value={formValues.destinationBankId}
                placeholder="Select destination bank"
                disabled={saving}
                excludeBankId={formValues.sourceBankId}
                onValueChange={(value) => updateFormValue("destinationBankId", value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="transferFee">Transfer Fee</Label>
              <Input
                id="transferFee"
                type="number"
                min="0"
                step="0.01"
                value={formValues.transferFee}
                disabled={saving}
                onChange={(event) => updateFormValue("transferFee", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Total Cash Outflow</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium tabular-nums">
                {formatMoney(
                  (Number(formValues.amount) || 0) +
                    (Number(formValues.transferFee) || 0),
                )}
              </div>
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={formValues.remarks}
                disabled={saving}
                onChange={(event) => updateFormValue("remarks", event.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t p-6 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || sourceBalanceIsNegative}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Prepare Transfer
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
