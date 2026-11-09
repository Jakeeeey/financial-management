"use client";

import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { PERIOD_LABELS } from "../constants";
import { lockFormSchema, type LockFormValues } from "../schemas";
import type { PeriodKey } from "../types";
import { Payments2307ApiError } from "../providers/payments2307Api";

interface LockDialogProps {
  periodKey: PeriodKey | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function LockDialog({ periodKey, isSaving, onClose, onSubmit }: LockDialogProps) {
  const [alert, setAlert] = useState<string | null>(null);
  const open = periodKey !== null;

  const form = useForm<LockFormValues>({
    resolver: zodResolver(lockFormSchema),
    defaultValues: { reason: "" },
  });

  async function submit(values: LockFormValues) {
    if (isSaving) return;
    setAlert(null);
    try {
      await onSubmit(values.reason.trim());
      form.reset();
      onClose();
    } catch (error) {
      if (error instanceof Payments2307ApiError && error.fieldErrors) {
        const reason = error.fieldErrors.reason?.[0];
        if (reason) form.setError("reason", { message: reason });
      }
      setAlert(error instanceof Error ? error.message : "The period was not locked.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSaving) {
          form.reset();
          setAlert(null);
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle>Lock {periodKey ? PERIOD_LABELS[periodKey] : "the period"}</DialogTitle>
          <DialogDescription>
            Locking closes the period to new payments and certificates. The reason is written to the change log. Locks here are an activity trail, not tamper-proof.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="lock-period-form"
            onSubmit={form.handleSubmit(submit)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {alert ? (
                <Alert variant="destructive">
                  <AlertDescription>{alert}</AlertDescription>
                </Alert>
              ) : null}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        maxLength={300}
                        placeholder="e.g. Q3 filed on 2026-10-25; figures frozen for the CPA review"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="lock-period-form" disabled={isSaving} className="min-h-11 md:min-h-0">
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Lock
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
