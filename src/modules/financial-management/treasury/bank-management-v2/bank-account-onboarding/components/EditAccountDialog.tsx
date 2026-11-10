"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ACCOUNT_TYPE_OPTIONS, BANK_STATUSES, statusLabel } from "../constants";
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
    status: account?.status ?? "ACTIVE",
    effectiveDate: account?.effectiveDate ?? phtToday(),
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

  const glOptions = options.cashAccounts.map((glAccount) => ({
    value: String(glAccount.coaId),
    label: `${glAccount.glCode} · ${glAccount.accountTitle}`,
    searchText: `${glAccount.glCode} ${glAccount.accountTitle}`,
  }));

  async function handleSubmit(values: UpdateAccountFormValues) {
    if (!account) return;
    const outcome = await onSubmit(account.bankId, {
      accountName: values.accountName.trim(),
      branch: values.branch.trim(),
      accountType: values.accountType,
      glCoaId: Number(values.glCoaId),
      status: values.status,
      effectiveDate: values.effectiveDate,
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
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[600px]">
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
                            <SelectValue placeholder="Choose the type" />
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose the status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {BANK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabel(status)}
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
                          placeholder="Choose a current-asset GL"
                          searchPlaceholder="Search GL code or title"
                          emptyLabel="No current-asset GL account matches that search."
                        />
                      </FormControl>
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
                        Effective date <span className="text-destructive">*</span>
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
            </div>

            <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
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
