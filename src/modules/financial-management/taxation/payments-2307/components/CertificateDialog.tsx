"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  DIRECTIONS,
  DIRECTION_LABELS,
  INCOME_TYPE_OPTIONS,
  PERIOD_KEYS,
  PERIOD_LABELS,
  WITHHOLDING_RATES,
} from "../constants";
import { Payments2307ApiError } from "../providers/payments2307Api";
import {
  blankToNull,
  certificateFormSchema,
  toAmount,
  type CertificateBody,
  type CertificateFormValues,
} from "../schemas";
import type { CertificateRow, WithholdingIncomeType } from "../types";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

const FORM_ID = "certificate-2307-form";

function blankValues(): CertificateFormValues {
  return {
    periodKey: "Q1",
    direction: "RECEIVED",
    incomeType: "OTHER",
    counterpartyName: "",
    counterpartyTin: "",
    incomeAmount: "",
    taxRate: "",
    taxWithheld: "",
    dateReceived: "",
    remarks: "",
  };
}

function valuesFrom(certificate: CertificateRow): CertificateFormValues {
  return {
    periodKey: certificate.periodKey,
    direction: certificate.direction,
    incomeType: certificate.incomeType,
    counterpartyName: certificate.counterpartyName,
    counterpartyTin: certificate.counterpartyTin ?? "",
    incomeAmount: certificate.incomeAmount ? String(Number(certificate.incomeAmount.toFixed(2))) : "",
    taxRate: String(Number(certificate.taxRate.toFixed(2))),
    taxWithheld: String(Number(certificate.taxWithheld.toFixed(2))),
    dateReceived: certificate.dateReceived ?? "",
    remarks: certificate.remarks ?? "",
  };
}

interface CertificateDialogProps {
  open: boolean;
  certificate: CertificateRow | null;
  companyId: number;
  companyOptions: { value: string; label: string; searchText?: string; description?: string }[];
  onCompanyChange: (companyId: number) => void;
  year: number;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: CertificateBody) => Promise<void>;
}

export function CertificateDialog({
  open,
  certificate,
  companyId,
  companyOptions,
  onCompanyChange,
  year,
  isSaving,
  onOpenChange,
  onSubmit,
}: CertificateDialogProps) {
  const [alert, setAlert] = useState<string | null>(null);

  const form = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateFormSchema),
    defaultValues: blankValues(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(certificate ? valuesFrom(certificate) : blankValues());
  }, [open, certificate, form]);

  /** Withheld follows rate × income until someone types a different figure. */
  function recomputeWithheld() {
    const income = Number(form.getValues("incomeAmount"));
    const rate = Number(form.getValues("taxRate"));
    if (!Number.isFinite(income) || !Number.isFinite(rate) || income <= 0 || rate <= 0) return;
    form.setValue("taxWithheld", String(Math.round(income * rate) / 100), { shouldDirty: true });
  }

  function applyDefaultRate(incomeType: WithholdingIncomeType) {
    if (form.getValues("taxRate").trim() !== "") return;
    const rate = WITHHOLDING_RATES[incomeType];
    if (rate > 0) form.setValue("taxRate", String(rate * 100), { shouldDirty: true });
  }

  async function submit(values: CertificateFormValues) {
    if (isSaving) return;
    setAlert(null);
    try {
      await onSubmit({
        companyId,
        year,
        periodKey: values.periodKey,
        direction: values.direction,
        counterpartyCompanyId: null,
        counterpartyName: values.counterpartyName,
        counterpartyTin: blankToNull(values.counterpartyTin),
        incomeType: values.incomeType,
        incomeAmount: toAmount(values.incomeAmount),
        taxRate: Number(values.taxRate),
        taxWithheld: toAmount(values.taxWithheld),
        dateReceived: blankToNull(values.dateReceived),
        remarks: blankToNull(values.remarks),
      });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Payments2307ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0] && field in values) {
            form.setError(field as keyof CertificateFormValues, { message: messages[0] });
          }
        }
      }
      setAlert(error instanceof Error ? error.message : "The certificate was not saved.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSaving) return;
        if (!next) setAlert(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle>{certificate ? "Edit 2307 certificate" : "Add 2307 certificate"}</DialogTitle>
          <DialogDescription>
            One certificate per counterparty and period, {year}. Received means a supplier withheld from you; issued
            means you withheld from a payee.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {alert ? (
                <Alert variant="destructive">
                  <AlertDescription>{alert}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <OptionCombobox
                    options={companyOptions}
                    value={String(companyId)}
                    onChange={(next) => {
                      const parsed = Number(next);
                      if (Number.isInteger(parsed) && parsed > 0) onCompanyChange(parsed);
                    }}
                    placeholder="Pick a company"
                    searchPlaceholder="Search companies"
                    emptyLabel="No company matches"
                    disabled={certificate !== null}
                  />
                  <FormDescription>
                    {certificate ? "The company of an existing row cannot change." : "The row is filed for this company."}
                  </FormDescription>
                </FormItem>

                <FormField
                  control={form.control}
                  name="periodKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Period <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Certificate period">
                            <SelectValue placeholder="Pick a period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {PERIOD_KEYS.map((period) => (
                            <SelectItem key={period} value={period}>
                              {PERIOD_LABELS[period]}
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
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Direction <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Certificate direction">
                            <SelectValue placeholder="Received or issued" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {DIRECTIONS.map((direction) => (
                            <SelectItem key={direction} value={direction}>
                              {DIRECTION_LABELS[direction]}
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
                  name="incomeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Income type <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(next: WithholdingIncomeType) => {
                          field.onChange(next);
                          applyDefaultRate(next);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Income type">
                            <SelectValue placeholder="Pick an income type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {INCOME_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="counterpartyName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        Issuer / payee <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={180} placeholder="Registered name on the certificate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="counterpartyTin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIN</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={30} placeholder="000-000-000-000" className="tabular-nums" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateReceived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date received</FormLabel>
                      <FormControl>
                        <DateField
                          inDialog
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick the date received"
                          aria-label="Date received"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incomeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Income <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          placeholder="0.00"
                          onBlur={() => {
                            field.onBlur();
                            recomputeWithheld();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Rate % <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          placeholder="2"
                          onBlur={() => {
                            field.onBlur();
                            recomputeWithheld();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxWithheld"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Withheld <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="decimal" className="text-right tabular-nums" placeholder="0.00" />
                      </FormControl>
                      <FormDescription>Rate × income, editable.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} maxLength={300} placeholder="Optional note" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form={FORM_ID} disabled={isSaving} className="min-h-11 md:min-h-0">
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {certificate ? "Save certificate" : "Add certificate"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
