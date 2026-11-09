"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { CREDIT_NATURE_OPTIONS } from "../../constants";
import { phtToday } from "../../pht";
import { ApiError } from "../../providers/transactionsApi";
import { creditFormSchema, toAmount, type CreditFormValues, type MemoBody } from "../../schemas";
import type { AccountOption } from "../../types";
import { DateField } from "../DateField";
import { InlineAlert } from "../InlineAlert";
import { OptionCombobox } from "../OptionCombobox";

interface CreditMemoFormProps {
  formId: string;
  accounts: AccountOption[];
  isSaving: boolean;
  onSubmit: (body: MemoBody) => Promise<unknown>;
  onPosted: () => void;
}

/** E02 — the bank added funds; the counter account comes from the chosen nature. */
export function CreditMemoForm({ formId, accounts, isSaving, onSubmit, onPosted }: CreditMemoFormProps) {
  const [alert, setAlert] = useState<string | null>(null);

  const form = useForm<CreditFormValues>({
    resolver: zodResolver(creditFormSchema),
    defaultValues: {
      bankAccountId: "",
      valueDate: phtToday(),
      amount: "",
      natureKey: "AR_SETTLEMENT",
      description: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await onSubmit({
        kind: "CREDIT",
        bankAccountId: Number(values.bankAccountId),
        valueDate: values.valueDate,
        amount: toAmount(values.amount),
        natureKey: values.natureKey,
        description: values.description,
      });
      onPosted();
    } catch (error) {
      setAlert(error instanceof ApiError ? error.message : "The memo could not be saved. Try again.");
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
                  options={accounts.map((account) => ({ value: String(account.bankId), label: account.label }))}
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

        <FormField
          control={form.control}
          name="natureKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nature of the credit <span className="text-destructive">*</span>
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose the nature" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-80">
                  {CREDIT_NATURE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Decides the counter account the credit is posted against.</FormDescription>
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
                  placeholder="What the bank credited, if not obvious"
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
