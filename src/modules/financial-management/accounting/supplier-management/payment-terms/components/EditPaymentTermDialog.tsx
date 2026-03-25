"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { PaymentTerm } from "../types";

// 1. Define schema with .nullish() to handle null or undefined from API
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullish().or(z.literal("")),
  days: z.coerce.number().min(0, "Days must be 0 or more"),
});

// 2. Explicitly extract the type for the form values
type FormValues = z.infer<typeof formSchema>;

interface EditPaymentTermDialogProps {
  term: PaymentTerm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPaymentTermDialog({
  term,
  open,
  onOpenChange,
  onSuccess,
}: EditPaymentTermDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3. Pass FormValues to useForm to satisfy TypeScript's control checks
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as import("react-hook-form").Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      days: 0,
    },
  });

  // 4. Sync form state with the term when the dialog opens
  useEffect(() => {
    if (open && term) {
      form.reset({
        name: term.name,
        description: term.description ?? "",
        days: term.days,
      });
    }
  }, [term, open, form]);

  async function onSubmit(values: FormValues) {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/fm/accounting/supplier-management/payment-terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to update");
      }

      toast.success("Payment term updated successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Payment Term</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Net 30" {...field} />
                  </FormControl>
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
                      placeholder="Optional description..."
                      className="min-h-24 max-h-48 resize-y overflow-y-auto [field-sizing:fixed]"
                      {...field}
                      value={field.value ?? ""} // Ensure null doesn't break input
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}