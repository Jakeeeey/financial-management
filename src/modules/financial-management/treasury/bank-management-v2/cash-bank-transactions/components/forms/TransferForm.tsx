"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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

import { phtToday } from "../../pht";
import { ApiError } from "../../providers/transactionsApi";
import { toAmount, transferFormSchema, type TransferFormValues, type TransferBody } from "../../schemas";
import type { AccountOption } from "../../types";
import { DateField } from "../DateField";
import { InlineAlert } from "../InlineAlert";
import { OptionCombobox } from "../OptionCombobox";

interface TransferFormProps {
  formId: string;
  accounts: AccountOption[];
  isSaving: boolean;
  onSubmit: (body: TransferBody) => Promise<unknown>;
  onPosted: () => void;
}

/** E05 for today's value date, E06 (leg 1) for a later one, settled from the clearing panel. */
export function TransferForm({ formId, accounts, isSaving, onSubmit, onPosted }: TransferFormProps) {
  const [alert, setAlert] = useState<string | null>(null);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      sourceBankId: "",
      destinationBankId: "",
      amount: "",
      transferFee: "",
      valueDate: phtToday(),
      remarks: "",
    },
  });

  const sourceId = useWatch({ control: form.control, name: "sourceBankId" });
  const valueDate = useWatch({ control: form.control, name: "valueDate" });
  const destinationOptions = useMemo(
    () => accounts.filter((account) => String(account.bankId) !== sourceId),
    [accounts, sourceId],
  );
  const settlesLater = valueDate > phtToday();

  const submit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await onSubmit({
        sourceBankId: Number(values.sourceBankId),
        destinationBankId: Number(values.destinationBankId),
        amount: toAmount(values.amount),
        transferFee: values.transferFee.trim() === "" ? 0 : toAmount(values.transferFee),
        valueDate: values.valueDate,
        remarks: values.remarks,
      });
      onPosted();
    } catch (error) {
      setAlert(error instanceof ApiError ? error.message : "The transfer could not be saved. Try again.");
    }
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {alert ? <InlineAlert>{alert}</InlineAlert> : null}

        <FormField
          control={form.control}
          name="sourceBankId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                From account <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <OptionCombobox
                  options={accounts.map((option) => ({ value: String(option.bankId), label: option.label }))}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    if (value === form.getValues("destinationBankId")) form.setValue("destinationBankId", "");
                  }}
                  placeholder="Choose the source account"
                  searchPlaceholder="Search accounts…"
                  emptyLabel="No account matches."
                  disabled={isSaving}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="destinationBankId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                To account <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <OptionCombobox
                  options={destinationOptions.map((option) => ({ value: String(option.bankId), label: option.label }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Choose the destination account"
                  searchPlaceholder="Search accounts…"
                  emptyLabel="No account matches."
                  disabled={isSaving || !sourceId}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
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

          <FormField
            control={form.control}
            name="transferFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer fee</FormLabel>
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
                <FormDescription>Posted to bank charges and added to what leaves the source account.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
              <FormDescription>Today credits the destination at once. Later dates settle from clearing.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {settlesLater ? (
          <InlineAlert tone="info">
            Value date {valueDate}. The money leaves the source account now through transfer-in-transit and is settled on
            or after that date.
          </InlineAlert>
        ) : null}

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Reference the bank advice, if any"
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
