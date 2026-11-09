"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { phtToday } from "../../pht";
import { ApiError } from "../../providers/transactionsApi";
import { debitFormSchema, toAmount, type DebitFormValues, type MemoBody } from "../../schemas";
import type { AccountOption, ExpenseAccountOption } from "../../types";
import { DateField } from "../DateField";
import { ExpenseAccountPicker } from "../ExpenseAccountPicker";
import { InlineAlert } from "../InlineAlert";
import { OptionCombobox } from "../OptionCombobox";

interface DebitMemoFormProps {
  formId: string;
  accounts: AccountOption[];
  expenseAccounts: ExpenseAccountOption[];
  isSaving: boolean;
  onSubmit: (body: MemoBody) => Promise<unknown>;
  onPosted: () => void;
}

/** E03 — a bank charge; the expense account picks the debit line. */
export function DebitMemoForm({
  formId,
  accounts,
  expenseAccounts,
  isSaving,
  onSubmit,
  onPosted,
}: DebitMemoFormProps) {
  const [alert, setAlert] = useState<string | null>(null);

  const form = useForm<DebitFormValues>({
    resolver: zodResolver(debitFormSchema),
    defaultValues: {
      bankAccountId: "",
      valueDate: phtToday(),
      amount: "",
      expenseCoaId: "",
      description: "",
    },
  });

  const accountId = useWatch({ control: form.control, name: "bankAccountId" });
  const amountValue = Number(useWatch({ control: form.control, name: "amount" }));
  const account = accounts.find((option) => String(option.bankId) === accountId);
  const overdraws =
    Boolean(account) && Number.isFinite(amountValue) && amountValue > 0 && amountValue > (account?.bookBalance ?? 0);

  const submit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await onSubmit({
        kind: "DEBIT",
        bankAccountId: Number(values.bankAccountId),
        valueDate: values.valueDate,
        amount: toAmount(values.amount),
        expenseCoaId: Number(values.expenseCoaId),
        description: values.description,
      });
      onPosted();
    } catch (error) {
      setAlert(error instanceof ApiError ? error.message : "The debit memo could not be saved. Try again.");
    }
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {alert ? <InlineAlert>{alert}</InlineAlert> : null}

        <FormField
          control={form.control}
          name="bankAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Bank account <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <OptionCombobox
                  options={accounts.map((option) => ({ value: String(option.bankId), label: option.label }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Choose the bank account"
                  searchPlaceholder="Search accounts…"
                  emptyLabel="No account matches."
                  disabled={isSaving}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="valueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Value date <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    inDialog
                    disabled={isSaving}
                    placeholder="Pick the value date"
                  />
                </FormControl>
                <FormDescription>Today or earlier.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Amount <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="decimal"
                    placeholder="0.00"
                    autoComplete="off"
                    disabled={isSaving}
                    className="text-right tabular-nums"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {overdraws && account ? (
          <InlineAlert tone="warning">
            This debit is larger than the book balance of {formatCurrency(account.bookBalance)}. It still posts, but
            check the amount before submitting.
          </InlineAlert>
        ) : null}

        <FormField
          control={form.control}
          name="expenseCoaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Expense account <span className="text-destructive">*</span>
              </FormLabel>
              <ExpenseAccountPicker
                options={expenseAccounts}
                value={field.value}
                onChange={field.onChange}
                disabled={isSaving}
                invalid={Boolean(form.formState.errors.expenseCoaId)}
              />
              <FormDescription>Charges, fees and penalties the bank deducted.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="What the bank charged for"
                  className="min-h-[100px] resize-none"
                  disabled={isSaving}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
