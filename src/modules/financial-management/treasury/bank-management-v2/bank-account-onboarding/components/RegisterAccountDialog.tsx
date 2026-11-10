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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { ACCOUNT_TYPE_OPTIONS } from "../constants";
import { phtToday } from "../pht";
import { registerAccountFormSchema, type RegisterAccountFormValues } from "../schemas";
import type { RegisterAccountPayload } from "../providers/onboardingApi";
import type { FormOutcome, OnboardingOptions } from "../types";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

// ponytail: the repo carries no company-name constant, so the holder starts blank
// rather than pre-filling a name the user never chose.
const DEFAULT_ACCOUNT_HOLDER = "";

function defaults(): RegisterAccountFormValues {
  return {
    bankName: "",
    branch: "",
    accountNumber: "",
    accountName: DEFAULT_ACCOUNT_HOLDER,
    accountType: "Savings",
    glCoaId: "",
    openingBalance: "0",
    effectiveDate: phtToday(),
    remarks: "",
  };
}

type RegisterAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: OnboardingOptions;
  isSaving: boolean;
  onSubmit: (payload: RegisterAccountPayload) => Promise<FormOutcome>;
};

/** FSD 1.1 registration: creates the account, then posts E01 once when funded. */
export function RegisterAccountDialog({
  open,
  onOpenChange,
  options,
  isSaving,
  onSubmit,
}: RegisterAccountDialogProps) {
  const form = useForm<RegisterAccountFormValues>({
    resolver: zodResolver(registerAccountFormSchema) as Resolver<RegisterAccountFormValues>,
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, form]);

  const accountType = useWatch({ control: form.control, name: "accountType" });
  const balanceCurrency = accountType === "FCA" ? "USD" : "PHP";

  const bankOptions = options.banks.map((bank) => ({ value: bank.name, label: bank.name }));
  const glOptions = options.cashAccounts.map((account) => ({
    value: String(account.coaId),
    label: `${account.glCode} · ${account.accountTitle}`,
    searchText: `${account.glCode} ${account.accountTitle}`,
  }));

  async function handleSubmit(values: RegisterAccountFormValues) {
    const outcome = await onSubmit({
      bankName: values.bankName.trim(),
      branch: values.branch.trim(),
      accountNumber: values.accountNumber.trim(),
      accountName: values.accountName.trim(),
      accountType: values.accountType,
      glCoaId: Number(values.glCoaId),
      openingBalance: Number(values.openingBalance),
      effectiveDate: values.effectiveDate,
      remarks: values.remarks.trim() || undefined,
    });

    if (outcome.ok || outcome.blocked) {
      onOpenChange(false);
      return;
    }

    for (const [field, messages] of Object.entries(outcome.fieldErrors ?? {})) {
      if (field in values && messages[0]) {
        form.setError(field as keyof RegisterAccountFormValues, { type: "server", message: messages[0] });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[700px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Register bank account</DialogTitle>
              <DialogDescription>
                Add the account to the bank register. A funded account posts its opening balance once.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Bank name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <OptionCombobox
                          options={bankOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Choose or add a bank"
                          searchPlaceholder="Search or add a bank"
                          emptyLabel="No bank matches that search."
                          allowCustom
                        />
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
                        <Input {...field} placeholder="e.g. Makati Main" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Account no. / IBAN <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 0012-3456-7890" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      <FormDescription>FCA accounts are kept in USD; every other type is kept in PHP.</FormDescription>
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
                      {glOptions.length === 0 ? (
                        <FormDescription>
                          No current-asset GL accounts were returned, so the chart of accounts could not be read.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Opening balance ({balanceCurrency}){" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Registering…
                  </>
                ) : (
                  "Register account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
