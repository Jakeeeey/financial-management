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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { INTEREST_TAX_RATES } from "../../constants";
import { phtDate, phtToday } from "../../pht";
import { ApiError } from "../../providers/transactionsApi";
import { interestFormSchema, toAmount, type InterestFormValues, type MemoBody } from "../../schemas";
import type { AccountOption } from "../../types";

import { DateField } from "../DateField";
import { InlineAlert } from "../InlineAlert";
import { OptionCombobox } from "../OptionCombobox";

interface InterestFormProps {
  formId: string;
  accounts: AccountOption[];
  isSaving: boolean;
  onSubmit: (body: MemoBody) => Promise<unknown>;
  onPosted: () => void;
}

/** E04 — interest credited gross, final tax withheld, net goes to the bank account. */
export function InterestForm({ formId, accounts, isSaving, onSubmit, onPosted }: InterestFormProps) {
  const [alert, setAlert] = useState<string | null>(null);

  const form = useForm<InterestFormValues>({
    resolver: zodResolver(interestFormSchema),
    defaultValues: {
      bankAccountId: "",
      valueDate: phtToday(),
      gross: "",
      taxRate: "0.2",
      description: "",
    },
  });

  const grossValue = Number(useWatch({ control: form.control, name: "gross" }));
  const rate = Number(useWatch({ control: form.control, name: "taxRate" }));
  const hasGross = Number.isFinite(grossValue) && grossValue > 0;
  const tax = hasGross ? Math.round(grossValue * (Number.isFinite(rate) ? rate : 0) * 100) / 100 : 0;
  const net = hasGross ? Math.round((grossValue - tax) * 100) / 100 : 0;

  const submit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await onSubmit({
        kind: "INTEREST",
        bankAccountId: Number(values.bankAccountId),
        valueDate: values.valueDate,
        gross: toAmount(values.gross),
        taxRate: Number(values.taxRate),
        description: values.description,
      });
      onPosted();
    } catch (error) {
      setAlert(error instanceof ApiError ? error.message : "The interest memo could not be saved. Try again.");
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
                    maxDate={phtDate()}
                    placeholder="Pick the value date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gross"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Gross interest <span className="text-destructive">*</span>
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
          name="taxRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Final tax rate <span className="text-destructive">*</span>
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue className="truncate" placeholder="Choose the tax rate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-80">
                  {INTEREST_TAX_RATES.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Final tax is withheld at source by the bank.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Gross</span>
            <span className="tabular-nums">{formatCurrency(hasGross ? grossValue : 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Final tax withheld</span>
            <span className="tabular-nums">−{formatCurrency(tax)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-1 font-medium">
            <span>Net credited</span>
            <span className="tabular-nums">{formatCurrency(net)}</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Interest period, if worth recording"
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
