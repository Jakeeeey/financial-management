"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

type PsgcKind = "provinces" | "cities" | "barangays";

type PsgcOption = {
  code: string;
  name: string;
  provinceCode?: string;
  cityCode?: string;
};

type LocationCodes = {
  provinceCode: string;
  cityCode: string;
  barangayCode: string;
};

type PsgcLoadingState = Record<PsgcKind, boolean>;

type PostalCodeOption = {
  postalCode: string;
  placeName: string;
  provinceName?: string;
};

type PsgcSelectProps = {
  options: PsgcOption[];
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  onOpen?: () => void;
  onSelect: (option: PsgcOption) => void;
};

async function getPsgcOptions(
  kind: PsgcKind,
  filters: { provinceCode?: string; cityCode?: string } = {},
) {
  const params = new URLSearchParams({ kind });
  if (filters.provinceCode) params.set("province_code", filters.provinceCode);
  if (filters.cityCode) params.set("city_code", filters.cityCode);

  const response = await fetch(
    `/api/fm/treasury/bank-management/account-management/psgc?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error("Failed to load PSGC address data");

  const json = await response.json();
  return (json.options || []) as PsgcOption[];
}

async function getPostalCodeOptions(
  province: string,
  city: string,
  barangay: string,
) {
  const params = new URLSearchParams({ city });
  if (province) params.set("province", province);
  if (barangay) params.set("barangay", barangay);

  const response = await fetch(
    `/api/fm/payee-registration/postal-code?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error("Failed to load postal code suggestions");

  const json = await response.json();
  return (json.options || []) as PostalCodeOption[];
}

function PsgcSelect({
  options,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  onOpen,
  onSelect,
}: PsgcSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.name === value);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = (normalizedQuery
    ? options.filter((option) =>
      `${option.name} ${option.code}`.toLowerCase().includes(normalizedQuery),
    )
    : options
  ).slice(0, 100);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setQuery("");
          onOpen?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedOption?.name || value || placeholder}
          </span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{loading ? "Loading..." : emptyText}</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.name} ${option.code}`}
                  onSelect={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.name ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const provinceValue = form.watch("state_province");
  const cityValue = form.watch("city");
  const barangayValue = form.watch("brgy");
  const [provinceOptions, setProvinceOptions] = useState<PsgcOption[]>([]);
  const [cityOptions, setCityOptions] = useState<PsgcOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<PsgcOption[]>([]);
  const [postalCodeOptions, setPostalCodeOptions] = useState<PostalCodeOption[]>([]);
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const [postalCodeEditedManually, setPostalCodeEditedManually] = useState(false);
  const [locationCodes, setLocationCodes] = useState<LocationCodes>({
    provinceCode: "",
    cityCode: "",
    barangayCode: "",
  });
  const [psgcLoading, setPsgcLoading] = useState<PsgcLoadingState>({
    provinces: false,
    cities: false,
    barangays: false,
  });
  const [psgcError, setPsgcError] = useState<string | null>(null);
  const psgcSeqRef = useRef({ provinces: 0, cities: 0, barangays: 0 });
  const postalCodeSeqRef = useRef(0);
  const postalCodeEditedManuallyRef = useRef(false);

  const selectedCity = useMemo(
    () => cityOptions.find((city) => city.code === locationCodes.cityCode),
    [cityOptions, locationCodes.cityCode],
  );
  const selectedProvince = useMemo(
    () => provinceOptions.find((province) => province.code === locationCodes.provinceCode),
    [provinceOptions, locationCodes.provinceCode],
  );
  const displayedProvinceOptions = useMemo(() => {
    if (locationCodes.cityCode || locationCodes.barangayCode) {
      return selectedProvince ? [selectedProvince] : [];
    }
    return provinceOptions;
  }, [locationCodes.barangayCode, locationCodes.cityCode, provinceOptions, selectedProvince]);
  const displayedCityOptions = useMemo(() => {
    if (locationCodes.barangayCode) {
      return selectedCity ? [selectedCity] : [];
    }
    return cityOptions;
  }, [cityOptions, locationCodes.barangayCode, selectedCity]);

  const loadPsgcOptions = useCallback(async (
    kind: PsgcKind,
    filters: { provinceCode?: string; cityCode?: string } = {},
  ) => {
    const seq = psgcSeqRef.current[kind] + 1;
    psgcSeqRef.current[kind] = seq;
    setPsgcLoading((current) => ({ ...current, [kind]: true }));
    setPsgcError(null);

    try {
      const options = await getPsgcOptions(kind, filters);
      if (seq !== psgcSeqRef.current[kind]) return options;

      if (kind === "provinces") setProvinceOptions(options);
      if (kind === "cities") setCityOptions(options);
      if (kind === "barangays") setBarangayOptions(options);
      return options;
    } catch {
      if (seq === psgcSeqRef.current[kind]) {
        setPsgcError("Failed to load PSGC address data");
      }
      return [];
    } finally {
      setPsgcLoading((current) => ({ ...current, [kind]: false }));
    }
  }, []);

  const loadPostalCodeOptions = useCallback(async (
    province: string,
    city: string,
    barangay: string,
  ) => {
    const seq = postalCodeSeqRef.current + 1;
    postalCodeSeqRef.current = seq;
    const trimmedProvince = province.trim();
    const trimmedCity = city.trim();
    const trimmedBarangay = barangay.trim();

    if (!trimmedCity) {
      setPostalCodeOptions([]);
      setPostalCodeError(null);
      setPostalCodeLoading(false);
      return;
    }

    setPostalCodeLoading(true);
    setPostalCodeError(null);

    try {
      const options = await getPostalCodeOptions(
        trimmedProvince,
        trimmedCity,
        trimmedBarangay,
      );
      if (seq !== postalCodeSeqRef.current) return;

      setPostalCodeOptions(options);
      if (options.length === 1 && !postalCodeEditedManuallyRef.current) {
        form.setValue("postal_code", options[0].postalCode, { shouldValidate: true });
      }
    } catch {
      if (seq === postalCodeSeqRef.current) {
        setPostalCodeOptions([]);
        setPostalCodeError("Postal code could not be suggested. Enter it manually.");
      }
    } finally {
      if (seq === postalCodeSeqRef.current) {
        setPostalCodeLoading(false);
      }
    }
  }, [form]);

  useEffect(() => {
    if (!isTrade) return;

    void loadPsgcOptions("provinces");
    void loadPsgcOptions("cities");
  }, [isTrade, loadPsgcOptions]);

  useEffect(() => {
    if (!locationCodes.provinceCode || provinceValue) return;
    const province = provinceOptions.find((option) => option.code === locationCodes.provinceCode);
    if (province) form.setValue("state_province", province.name, { shouldValidate: true });
  }, [form, locationCodes.provinceCode, provinceOptions, provinceValue]);

  useEffect(() => {
    if (!locationCodes.cityCode || cityValue) return;
    const city = cityOptions.find((option) => option.code === locationCodes.cityCode);
    if (city) form.setValue("city", city.name, { shouldValidate: true });
  }, [cityOptions, cityValue, form, locationCodes.cityCode]);

  useEffect(() => {
    if (!isTrade) return;
    void loadPostalCodeOptions(
      provinceValue || "",
      cityValue || "",
      barangayValue || "",
    );
  }, [barangayValue, cityValue, isTrade, loadPostalCodeOptions, provinceValue]);

  function resetPostalCodeForLocationChange() {
    postalCodeEditedManuallyRef.current = false;
    setPostalCodeEditedManually(false);
    setPostalCodeOptions([]);
    setPostalCodeError(null);
    form.setValue("postal_code", "", { shouldValidate: true });
  }

  function selectProvince(option: PsgcOption) {
    resetPostalCodeForLocationChange();
    setLocationCodes({
      provinceCode: option.code,
      cityCode: "",
      barangayCode: "",
    });
    form.setValue("state_province", option.name, { shouldValidate: true });
    form.setValue("city", "", { shouldValidate: true });
    form.setValue("brgy", "", { shouldValidate: true });
    void loadPsgcOptions("cities", { provinceCode: option.code });
    void loadPsgcOptions("barangays", { provinceCode: option.code });
  }

  function selectCity(option: PsgcOption) {
    const province = provinceOptions.find((item) => item.code === option.provinceCode);

    resetPostalCodeForLocationChange();
    setLocationCodes({
      provinceCode: option.provinceCode || "",
      cityCode: option.code,
      barangayCode: "",
    });
    form.setValue("state_province", province?.name || "", { shouldValidate: true });
    form.setValue("city", option.name, { shouldValidate: true });
    form.setValue("brgy", "", { shouldValidate: true });

    if (option.provinceCode) {
      void loadPsgcOptions("cities", { provinceCode: option.provinceCode });
    }
    void loadPsgcOptions("barangays", { cityCode: option.code });
  }

  function selectBarangay(option: PsgcOption) {
    const city = cityOptions.find((item) => item.code === option.cityCode);
    const province = provinceOptions.find((item) => item.code === (city?.provinceCode || option.provinceCode));

    resetPostalCodeForLocationChange();
    setLocationCodes({
      provinceCode: city?.provinceCode || option.provinceCode || "",
      cityCode: city?.code || option.cityCode || "",
      barangayCode: option.code,
    });
    form.setValue("state_province", province?.name || form.getValues("state_province"), { shouldValidate: true });
    form.setValue("city", city?.name || form.getValues("city"), { shouldValidate: true });
    form.setValue("brgy", option.name, { shouldValidate: true });
  }

  function loadBarangaysForCurrentLocation() {
    if (locationCodes.cityCode) {
      void loadPsgcOptions("barangays", { cityCode: locationCodes.cityCode });
      return;
    }

        const uploadRes = await fetch("/api/fm/payee-registration/payee-image-upload", {
          method: "POST",
          body: formData,
        });

    if (barangayOptions.length === 0) {
      void loadPsgcOptions("barangays");
    }
  }

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

                {psgcError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {psgcError}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="state_province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Province <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <PsgcSelect
                            options={displayedProvinceOptions}
                            value={field.value || ""}
                            disabled={isSubmitting || psgcLoading.provinces || displayedProvinceOptions.length === 0}
                            loading={psgcLoading.provinces}
                            placeholder="Select province"
                            searchPlaceholder="Search province..."
                            emptyText="No provinces found."
                            onSelect={selectProvince}
                          />
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
                          <PsgcSelect
                            options={displayedCityOptions}
                            value={field.value || ""}
                            disabled={isSubmitting || psgcLoading.cities || displayedCityOptions.length === 0}
                            loading={psgcLoading.cities}
                            placeholder="Select city or municipality"
                            searchPlaceholder="Search city or municipality..."
                            emptyText="No cities or municipalities found."
                            onSelect={selectCity}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="brgy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Barangay <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <PsgcSelect
                            options={barangayOptions}
                            value={field.value || ""}
                            disabled={isSubmitting || psgcLoading.barangays || psgcLoading.cities}
                            loading={psgcLoading.barangays}
                            placeholder="Select barangay"
                            searchPlaceholder="Search barangay..."
                            emptyText="No barangays found."
                            onOpen={loadBarangaysForCurrentLocation}
                            onSelect={selectBarangay}
                          />
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
                          <Input
                            placeholder="0000"
                            {...field}
                            onChange={(event) => {
                              postalCodeEditedManuallyRef.current = true;
                              setPostalCodeEditedManually(true);
                              field.onChange(event.target.value.replace(/\D/g, "").slice(0, 4));
                            }}
                          />
                        </FormControl>
                        {postalCodeLoading ? (
                          <p className="text-xs text-muted-foreground">
                            Looking up postal code...
                          </p>
                        ) : null}
                        {postalCodeError ? (
                          <p className="text-xs text-muted-foreground">
                            {postalCodeError}
                          </p>
                        ) : null}
                        {postalCodeOptions.length > 1 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {postalCodeOptions.slice(0, 5).map((option) => (
                              <Button
                                key={`${option.postalCode}-${option.placeName}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  postalCodeEditedManuallyRef.current = false;
                                  setPostalCodeEditedManually(false);
                                  field.onChange(option.postalCode);
                                }}
                              >
                                {option.postalCode}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                        {postalCodeEditedManually && postalCodeOptions.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Postal code is manually edited.
                          </p>
                        ) : null}
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
