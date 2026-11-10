"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MinusCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import { CLOSURE_REASONS, FINAL_WHT_RATE } from "../constants";
import { phtToday } from "../pht";
import type { DormancyAccount, PreClosureResult } from "../types";

type Props = {
  accounts: DormancyAccount[];
  preClosure: PreClosureResult | null;
  isLoadingCheck: boolean;
  isSaving: boolean;
  onValidate: (bankId: number) => void;
  onSettle: (bankId: number, accruedInterest: number, cutOff: string) => Promise<boolean>;
  onLock: (bankId: number, reason: string) => Promise<boolean>;
};

function StepHeader({ step, title, done }: { step: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
          done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {step}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

export function CloseAccountPanel({
  accounts,
  preClosure,
  isLoadingCheck,
  isSaving,
  onValidate,
  onSettle,
  onLock,
}: Props) {
  const [bankId, setBankId] = useState<string>("");
  const [accruedInterest, setAccruedInterest] = useState("0");
  const [cutOff, setCutOff] = useState(phtToday());
  const [reason, setReason] = useState<string>(CLOSURE_REASONS[0]);

  const selected = accounts.find((account) => String(account.bankId) === bankId) ?? null;
  const canClose = Boolean(preClosure?.canClose);
  const interest = Number(accruedInterest) || 0;
  const tax = Math.round(interest * FINAL_WHT_RATE * 100) / 100;
  const net = Math.round((interest - tax) * 100) / 100;

  return (
    <section
      aria-label="Account closure and derecognition gate"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-teal-500/70 bg-card shadow-sm"
    >
      <header className="border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold">Account closure &amp; derecognition gate</h2>
        <p className="text-xs text-muted-foreground">
          Validate, settle the last interest, then lock the status. Closure is permanent.
        </p>
      </header>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="closure-account">Account</Label>
            <OptionCombobox
              id="closure-account"
              options={accounts.map((account) => ({
                value: String(account.bankId),
                label: `${account.bankName} · ${account.accountNumber}`,
                searchText: `${account.accountNumber} ${account.accountName ?? ""} ${account.branch ?? ""}`,
                description: account.accountName ?? undefined,
              }))}
              value={bankId}
              onChange={setBankId}
              placeholder="Choose an account"
              searchPlaceholder="Search account no. or holder…"
              emptyLabel="No account matches."
              className="w-full"
            />
          </div>
          <Button
            variant="outline"
            disabled={!bankId || isLoadingCheck}
            onClick={() => onValidate(Number(bankId))}
          >
            {isLoadingCheck && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {preClosure ? "Re-run closure check" : "Run closure check"}
          </Button>
        </div>

        {selected && (
          <p className="text-xs text-muted-foreground">
            Book balance {formatCurrency(selected.bookBalance)} · {selected.status.toLowerCase()} ·{" "}
            {selected.monthsInactive} months without customer activity
          </p>
        )}

        {isLoadingCheck && !preClosure ? (
          <Skeleton className="h-24 w-full" />
        ) : preClosure ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <StepHeader step={1} title="Pre-closure validation" />
              <ul className="space-y-2">
                {preClosure.checks.map((check) => (
                  <li key={check.key} className="flex items-start gap-2 text-sm">
                    {check.unverified ? (
                      <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    ) : check.passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className={check.passed ? "font-medium" : "font-medium text-red-700 dark:text-red-400"}>
                        {check.label}
                        {check.unverified ? (
                          <span className="ml-2 text-[11px] font-normal text-amber-700 dark:text-amber-400">
                            needs the bank&apos;s confirmation
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs break-words text-muted-foreground">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {!preClosure.canClose && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Closure is blocked. Clear every failed check above, then validate again. Transfer out the remaining
                  funds in Cash &amp; Bank Transactions and settle checks in Check &amp; Clearing Management.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <StepHeader step={2} title="Final settlement" done={canClose && net + tax === 0} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="closure-interest">Accrued interest to the cut-off</Label>
                  <Input
                    id="closure-interest"
                    type="number"
                    min={0}
                    step="0.01"
                    value={accruedInterest}
                    onChange={(event) => setAccruedInterest(event.target.value)}
                    disabled={!canClose}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="closure-cutoff">Closing cut-off</Label>
                  <DateField
                    id="closure-cutoff"
                    value={cutOff}
                    onChange={setCutOff}
                    maxDate={phtToday()}
                    disabled={!canClose}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
                <p className="font-medium">E18 — closure settlement</p>
                <p className="text-muted-foreground">
                  Dr interest expense {formatCurrency(interest)} · Cr 20% final tax {formatCurrency(tax)} · Cr net payout{" "}
                  {formatCurrency(net)}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!canClose || isSaving}
                onClick={async () => {
                  if (!bankId) return;
                  await onSettle(Number(bankId), interest, cutOff);
                }}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Post settlement (E18)
              </Button>
            </div>

            <div className="space-y-3">
              <StepHeader step={3} title="Status lock" />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="closure-reason">Closure reason</Label>
                  <Select value={reason} onValueChange={setReason} disabled={!canClose}>
                    <SelectTrigger id="closure-reason" className="w-full truncate">
                      <SelectValue className="truncate" placeholder="Choose a reason" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {CLOSURE_REASONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="destructive"
                  disabled={!canClose || isSaving}
                  onClick={async () => {
                    if (!bankId) return;
                    await onLock(Number(bankId), reason);
                  }}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Lock account as Closed
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Locking removes the account from every active dropdown and keeps its records for ten years.
                {selected?.retainUntil ? ` Currently retained until ${selected.retainUntil}.` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[11px]">
              Step 1
            </Badge>
            Choose an account and run the closure check to see what still blocks it.
          </div>
        )}
      </div>
    </section>
  );
}
