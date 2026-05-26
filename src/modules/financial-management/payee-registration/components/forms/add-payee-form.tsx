"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Payee, PayeeFormSchema, PayeeFormValues } from "../../types/payee.schema";
import {
  useDeliveryTerms,
  usePaymentTerms,
} from "@/modules/financial-management/supplier-registration/hooks/useTerms";

interface AddPayeeFormProps {
  onSuccess: (payee?: Payee) => void | Promise<void>;
  onCancel: () => void;
  supplierType?: "TRADE" | "NON-TRADE";
  allowSupplierTypeSelect?: boolean;
}

export function AddPayeeForm({
  onSuccess,
  onCancel,
  supplierType = "NON-TRADE",
  allowSupplierTypeSelect = false,
}: AddPayeeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supplierTypeLabel = supplierType === "TRADE" ? "Trade" : "Non-Trade";
  const { paymentTerms, isLoading: isLoadingPaymentTerms } = usePaymentTerms();
  const { deliveryTerms, isLoading: isLoadingDeliveryTerms } = useDeliveryTerms();
  const form = useForm({
    resolver: zodResolver(PayeeFormSchema),
    defaultValues: {
      supplier_name: "",
      supplier_shortcut: "",
      supplier_type: supplierType,
      tin_number: "",
      contact_person: "",
      bank_details: "",
      email_address: "",
      phone_number: "",
      address: "",
      brgy: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "Philippines",
      payment_terms: "",
      delivery_terms: "",
      notes_or_comments: "",
      agreement_or_contract: "",
      preferred_communication_method: "",
      isActive: 1,
    },
  });
  const selectedSupplierType = String(form.watch("supplier_type") ?? supplierType);
  const isTrade = selectedSupplierType === "TRADE";

  const onSubmit = async (data: PayeeFormValues) => {
    if (String(data.supplier_type) === "TRADE") {
      const requiredTradeFields: Array<keyof PayeeFormValues> = [
        "supplier_shortcut",
        "contact_person",
        "address",
        "brgy",
        "city",
        "state_province",
        "postal_code",
        "country",
        "payment_terms",
        "delivery_terms",
      ];
      const missingField = requiredTradeFields.find((field) => {
        const value = data[field];
        return typeof value !== "string" || value.trim().length === 0;
      });

      if (missingField) {
        toast.error("Please complete the required Trade supplier fields.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/fm/payee-registration/payees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create payee");
      }

      form.reset();
      await onSuccess(result.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create payee",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Payee Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter payee name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isTrade && (
              <FormField
                control={form.control}
                name="supplier_shortcut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Supplier Shortcut <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. NFPI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="supplier_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Supplier Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <select
                        value={String(field.value ?? "NON-TRADE")}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={!allowSupplierTypeSelect}
                        className={`flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm ${
                          allowSupplierTypeSelect
                            ? "bg-background text-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {allowSupplierTypeSelect ? (
                          <>
                            <option value="TRADE">Trade</option>
                            <option value="NON-TRADE">Non-Trade</option>
                          </>
                        ) : (
                          <option value={supplierType}>{supplierTypeLabel}</option>
                        )}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tin_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      TIN Number <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000000000"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event.target.value.replace(/\D/g, "").slice(0, 12));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bank_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Details</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Bank name, account number, or payment instructions"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="email_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Mobile or landline" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isTrade && (
              <div className="grid gap-4 border-t pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contact_person"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Contact Person <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter contact person" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferred_communication_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Communication</FormLabel>
                        <FormControl>
                          <Input placeholder="Email, phone, or messaging app" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Address <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="brgy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Barangay <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Barangay" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          City <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="state_province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Province <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Province" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Postal Code <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Country <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Philippines" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Payment Terms <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <select
                            value={String(field.value ?? "")}
                            onChange={(event) => field.onChange(event.target.value)}
                            disabled={isLoadingPaymentTerms}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          >
                            <option value="">
                              {isLoadingPaymentTerms ? "Loading terms..." : "Select payment terms"}
                            </option>
                            {paymentTerms.map((term) => (
                              <option key={term.id} value={term.name}>
                                {term.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delivery_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Delivery Terms <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <select
                            value={String(field.value ?? "")}
                            onChange={(event) => field.onChange(event.target.value)}
                            disabled={isLoadingDeliveryTerms}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          >
                            <option value="">
                              {isLoadingDeliveryTerms ? "Loading terms..." : "Select delivery terms"}
                            </option>
                            {deliveryTerms.map((term) => (
                              <option key={term.id} value={term.name}>
                                {term.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="agreement_or_contract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agreement / Contract</FormLabel>
                      <FormControl>
                        <Input placeholder="Contract reference or URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating..." : "Create Payee"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
