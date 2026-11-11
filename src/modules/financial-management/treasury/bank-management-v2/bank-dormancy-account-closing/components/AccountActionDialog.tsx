"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/lib/utils";
import { phtToday } from "../pht";
import type { DormancyAccount, EscheatRemittance } from "../types";
import { DateField } from "./DateField";

export type AccountAction = "RECLASSIFY" | "ESCHEAT" | "DEACTIVATE";

type Props = {
  account: DormancyAccount | null;
  action: AccountAction | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (account: DormancyAccount, action: AccountAction, remittance?: EscheatRemittance) => void;
};

const COPY: Record<AccountAction, { title: string; body: string; confirm: string }> = {
  RECLASSIFY: {
    title: "Reclassify to GL 201800",
    body: "The remaining deposit liability moves out of the active deposit account into dormant deposit liabilities. The account becomes Dormant, leaves every active dropdown, and is never released to profit or loss (IAS 32).",
    confirm: "Reclassify account",
  },
  ESCHEAT: {
    title: "Escheat under Act No. 3936",
    body: "A deposit dormant for ten years belongs to the National Treasury. The dormant liability moves to the statutory escheatment payable. The account is frozen and reports as Escheated, not as an ordinary customer closure.",
    confirm: "Escheat balance",
  },
  DEACTIVATE: {
    title: "Deactivate account",
    body: "The account is frozen: it leaves every picker and cannot receive deposits, checks or transfers. The book balance is not moved and must be zero, with no open check and no pending transfer, before this is allowed.",
    confirm: "Deactivate account",
  },
};

const EMPTY_REMITTANCE: EscheatRemittance = { reference: "", remittedOn: "", agency: "Bureau of the Treasury" };

export function AccountActionDialog({ account, action, isSaving, onOpenChange, onConfirm }: Props) {
  const open = Boolean(account && action);
  const copy = action ? COPY[action] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[550px]">
        {account && action && copy && (
          // Keyed so a different account or action starts from a clean P244 record without an effect.
          <ActionBody
            key={`${account.bankId}:${action}`}
            account={account}
            action={action}
            copy={copy}
            isSaving={isSaving}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionBody({
  account,
  action,
  copy,
  isSaving,
  onConfirm,
}: {
  account: DormancyAccount;
  action: AccountAction;
  copy: { title: string; body: string; confirm: string };
  isSaving: boolean;
  onConfirm: Props["onConfirm"];
}) {
  const [remittance, setRemittance] = useState<EscheatRemittance>(EMPTY_REMITTANCE);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: Partial<Record<keyof EscheatRemittance, string>> = {};
  if (action === "ESCHEAT") {
    if (!remittance.reference.trim()) errors.reference = "Enter the voucher or remittance reference.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(remittance.remittedOn)) {
      errors.remittedOn = "Pick the date the balance was remitted.";
    } else if (remittance.remittedOn > phtToday()) {
      errors.remittedOn = "The remittance date cannot be in the future.";
    }
    if (!remittance.agency.trim()) errors.agency = "Name the agency that received the money.";
  }
  const remittanceReady = action !== "ESCHEAT" || Object.keys(errors).length === 0;

  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden">
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle className="line-clamp-1">{copy.title}</DialogTitle>
        <DialogDescription className="line-clamp-2 max-w-md">
          {account.bankName} {account.accountNumber}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
        <p className="text-muted-foreground">{copy.body}</p>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Book balance
            </dt>
            <dd className="tabular-nums">{formatCurrency(account.bookBalance)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Event</dt>
            <dd>
              <Badge variant="outline" className="text-[11px]">
                {action === "RECLASSIFY" ? "E16" : action === "ESCHEAT" ? "E17" : "No posting"}
              </Badge>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posting</dt>
            <dd className="text-muted-foreground">
              {action === "RECLASSIFY"
                ? "Dr active deposit liability · Cr dormant deposit liabilities (201800)"
                : action === "ESCHEAT"
                  ? "Dr dormant deposit liabilities (201800) · Cr statutory escheatment payable (232300)"
                  : "None. The balance stays where it is; only the account is frozen."}
            </dd>
          </div>
        </dl>

        {action === "ESCHEAT" && (
          <fieldset className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Remittance record
            </legend>
            <div className="space-y-1">
              <Label htmlFor="escheat-reference" className="text-xs">
                Voucher / remittance reference
              </Label>
              <Input
                id="escheat-reference"
                value={remittance.reference}
                maxLength={60}
                placeholder="e.g. BTr-OR-2026-00417"
                aria-invalid={Boolean(errors.reference && touched.reference)}
                aria-describedby={errors.reference ? "escheat-reference-error" : undefined}
                onChange={(event) => setRemittance((prev) => ({ ...prev, reference: event.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, reference: true }))}
              />
              {errors.reference && touched.reference && (
                <p id="escheat-reference-error" className="text-xs text-destructive">
                  {errors.reference}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="escheat-remitted-on" className="text-xs">
                Remittance date
              </Label>
              <DateField
                id="escheat-remitted-on"
                inDialog
                value={remittance.remittedOn}
                maxDate={phtToday()}
                placeholder="When the balance was paid over"
                aria-invalid={Boolean(errors.remittedOn && touched.remittedOn)}
                aria-describedby={errors.remittedOn ? "escheat-remitted-on-error" : undefined}
                onChange={(value) => {
                  setTouched((prev) => ({ ...prev, remittedOn: true }));
                  setRemittance((prev) => ({ ...prev, remittedOn: value }));
                }}
              />
              {errors.remittedOn && touched.remittedOn && (
                <p id="escheat-remitted-on-error" className="text-xs text-destructive">
                  {errors.remittedOn}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="escheat-agency" className="text-xs">
                Agency that received the money
              </Label>
              <Input
                id="escheat-agency"
                value={remittance.agency}
                maxLength={80}
                aria-invalid={Boolean(errors.agency && touched.agency)}
                aria-describedby={errors.agency ? "escheat-agency-error" : undefined}
                onChange={(event) => setRemittance((prev) => ({ ...prev, agency: event.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, agency: true }))}
              />
              {errors.agency && touched.agency && (
                <p id="escheat-agency-error" className="text-xs text-destructive">
                  {errors.agency}
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This record rides on the E17 journal entry; the account itself keeps the escheat date and the ten-year
              retention date.
            </p>
          </fieldset>
        )}
      </div>

      <DialogFooter className="border-t bg-muted/20 px-6 py-4">
        <DialogClose asChild>
          <Button variant="outline" disabled={isSaving}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          variant={action === "RECLASSIFY" ? "default" : "destructive"}
          disabled={isSaving || !remittanceReady}
          onClick={() => onConfirm(account, action, action === "ESCHEAT" ? remittance : undefined)}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {copy.confirm}
        </Button>
      </DialogFooter>
    </div>
  );
}
