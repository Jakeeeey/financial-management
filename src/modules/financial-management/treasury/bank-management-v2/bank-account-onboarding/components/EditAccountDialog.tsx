"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch, type Resolver } from "react-hook-form";

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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  ACCOUNT_TYPE_OPTIONS,
  GL_PICKER_EMPTY,
  GL_PICKER_NON_CASH_BLOCKED,
  GL_PICKER_PLACEHOLDER,
  isCashAccountTitle,
  statusLabel,
} from "../constants";
import { phtToday } from "../pht";
import { updateAccountFormSchema, type UpdateAccountFormValues } from "../schemas";
import type { UpdateAccountPayload } from "../providers/onboardingApi";
import type { BankAccountV2, FormOutcome, OnboardingOptions } from "../types";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

function defaults(account: BankAccountV2 | null): UpdateAccountFormValues {
  return {
    accountName: account?.accountName ?? "",
    branch: account?.branch ?? "",
    accountType: account?.accountType ?? "Savings",
    glCoaId: account?.glCoaId === null || account?.glCoaId === undefined ? "" : String(account.glCoaId),
    reactivate: false,
    effectiveDate: account?.effectiveDate ?? phtToday(),
    remarks: account?.remarks ?? "",
  };
}

type EditAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccountV2 | null;
  options: OnboardingOptions;
  isSaving: boolean;
  onSubmit: (id: number, payload: UpdateAccountPayload) => Promise<FormOutcome>;
};

/** Edits the post-onboarding fields the FSD allows; closing an account only flips status. */
export function EditAccountDialog({
  open,
  onOpenChange,
  account,
  options,
  isSaving,
  onSubmit,
}: EditAccountDialogProps) {
  const form = useForm<UpdateAccountFormValues>({
    resolver: zodResolver(updateAccountFormSchema) as Resolver<UpdateAccountFormValues>,
    defaultValues: defaults(account),
  });

  useEffect(() => {
    if (open) form.reset(defaults(account));
  }, [open, account, form]);

  // The picker is cash-only now, but an older link (Land Bank → 4008) must still show
  // its real GL instead of a blank field.
  const linkedGl =
    account?.glCoaId && account.glCode && account.glTitle && !options.cashAccounts.some((gl) => gl.coaId === account.glCoaId)
      ? { coaId: account.glCoaId, glCode: account.glCode, accountTitle: account.glTitle }
      : null;
  const pickerAccounts = linkedGl ? [...options.cashAccounts, linkedGl] : options.cashAccounts;

  const glOptions = pickerAccounts.map((glAccount) => ({
    value: String(glAccount.coaId),
    label: `${glAccount.glCode} · ${glAccount.accountTitle}`,
    searchText: `${glAccount.glCode} ${glAccount.accountTitle}`,
  }));

  const glValue = useWatch({ control: form.control, name: "glCoaId" });
  const selectedGl = pickerAccounts.find((glAccount) => String(glAccount.coaId) === glValue);
  const nonCashSelected = selectedGl ? !isCashAccountTitle(selectedGl.accountTitle) : false;

  async function handleSubmit(values: UpdateAccountFormValues) {
    if (!account) return;
    // P53: a row still pointing at a non-cash GL must be remapped, not saved as-is.
    if (nonCashSelected) return;
    const outcome = await onSubmit(account.bankId, {
      accountName: values.accountName.trim(),
      branch: values.branch.trim(),
      accountType: values.accountType,
      glCoaId: Number(values.glCoaId),
      reactivate: values.reactivate,
      effectiveDate: values.effectiveDate,
      remarks: values.remarks.trim() || undefined,
    });

    if (outcome.ok) {
      onOpenChange(false);
      return;
    }

    for (const [field, messages] of Object.entries(outcome.fieldErrors ?? {})) {
      if (field in values && messages[0]) {
        form.setError(field as keyof UpdateAccountFormValues, { type: "server", message: messages[0] });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1">
                {account ? account.bankName : "Edit account"}
              </DialogTitle>
              <DialogDescription className="tabular-nums">
                {account ? account.accountNumber : "Account number unavailable"}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-bank-name">Bank name</Label>
                  <Input
                    id="edit-bank-name"
                    value={account?.bankName ?? ""}
                    readOnly
                    className="bg-muted"
                    title={account?.bankName ?? undefined}
                  />
                  <p className="text-xs text-muted-foreground">Fixed after onboarding.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-account-number">Account no. / IBAN</Label>
                  <Input
                    id="edit-account-number"
                    value={account?.accountNumber ?? ""}
                    readOnly
                    className="bg-muted tabular-nums"
                    title={account?.accountNumber ?? undefined}
                  />
                  <p className="text-xs text-muted-foreground">Fixed after onboarding.</p>
                </div>

                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Account holder <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Branch <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Account type <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue className="truncate" placeholder="Choose the type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {ACCOUNT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reactivate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                        <span className="text-sm font-medium">{statusLabel(account?.status ?? "ACTIVE")}</span>
                        {account?.status === "INACTIVE" && (
                          <label className="ml-auto flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={field.value}
                              onChange={(event) => field.onChange(event.target.checked)}
                            />
                            Reactivate
                          </label>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="glCoaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Linked GL <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <OptionCombobox
                          options={glOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={GL_PICKER_PLACEHOLDER}
                          searchPlaceholder="Search GL code or title"
                          emptyLabel={GL_PICKER_EMPTY}
                        />
                      </FormControl>
                      {nonCashSelected ? (
                        <FormDescription className="text-destructive">{GL_PICKER_NON_CASH_BLOCKED}</FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Onboarded on <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <DateField
                          value={field.value}
                          onChange={field.onChange}
                          maxDate={phtToday()}
                          placeholder="Pick the date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} className="min-h-[100px] resize-none" placeholder="Optional note" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSaving || nonCashSelected}
                title={nonCashSelected ? GL_PICKER_NON_CASH_BLOCKED : undefined}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
