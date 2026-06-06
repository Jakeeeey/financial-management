// src/modules/financial-management/treasury/bank-management/account-management/AccountManagementModule.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, FilterX, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccountManagement } from "./hooks/useAccountManagement";
import { accountManagementApi } from "./providers/accountManagementApi";
import type {
  AccountManagementFieldErrors,
  AccountManagementFormValues,
  AccountManagementQuery,
  AccountStatusFilter,
  BankAccount,
  PsgcOption,
} from "./types";

const PAGE_SIZE = 10;
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Checking", "Current", "Other"];

const emptyForm: AccountManagementFormValues = {
  bankName: "",
  accountType: "",
  accountName: "",
  accountNumber: "",
  bankDescription: "",
  branch: "",
  ifscCode: "",
  openingBalance: "",
  province: "",
  city: "",
  baranggay: "",
  email: "",
  mobileNo: "",
  contactPerson: "",
};

type FormMode = "create" | "edit";

type BankNameMatch = {
  bankName: string;
  kind: "duplicate" | "similar";
};

type TextFieldProps = {
  id: keyof AccountManagementFormValues;
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  error?: string;
  inputMode?: "numeric" | "text" | "email" | "decimal";
  maxLength?: number;
  pattern?: string;
  onChange: (id: keyof AccountManagementFormValues, value: string) => void;
};

type BankNameSelectProps = {
  bankNames: Array<{ bankName: string }>;
  value: string;
  disabled?: boolean;
  creating?: boolean;
  onValueChange: (value: string) => void;
  onCreateBankName: (bankName: string) => void;
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

type LocationCodes = {
  provinceCode: string;
  cityCode: string;
  barangayCode: string;
};

type PsgcLoadingState = {
  provinces: boolean;
  cities: boolean;
  barangays: boolean;
};

function sanitizeAccountNumber(value: string) {
  return value.replace(/[^A-Za-z0-9-]/g, "").replace(/-+/g, "-");
}

function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 20);
}

function hasFieldErrors(errors: AccountManagementFieldErrors) {
  return Object.values(errors).some(Boolean);
}

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function normalizeBankNameInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeBankNameKey(value: string) {
  return normalizeBankNameInput(value).toLowerCase();
}

function compactBankNameKey(value: string) {
  return normalizeBankNameKey(value).replace(/[^a-z0-9]/g, "");
}

function findSimilarBankNames(
  bankName: string,
  bankNames: Array<{ bankName: string }>,
): BankNameMatch[] {
  const normalizedName = normalizeBankNameKey(bankName);
  const compactName = compactBankNameKey(bankName);
  if (!normalizedName) return [];

  return bankNames
    .map((bank) => {
      const existingName = normalizeBankNameKey(bank.bankName);
      const existingCompact = compactBankNameKey(bank.bankName);

      if (existingName === normalizedName || existingCompact === compactName) {
        return { bankName: bank.bankName, kind: "duplicate" } as const;
      }

      const isSimilar =
        compactName.length >= 4 &&
        existingCompact.length >= 4 &&
        (existingCompact.includes(compactName) ||
          compactName.includes(existingCompact));

      return isSimilar
        ? ({ bankName: bank.bankName, kind: "similar" } as const)
        : null;
    })
    .filter((match): match is BankNameMatch => Boolean(match))
    .sort((first, second) => {
      if (first.kind === second.kind) return 0;
      return first.kind === "duplicate" ? -1 : 1;
    })
    .slice(0, 5);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function accountToForm(account: BankAccount): AccountManagementFormValues {
  return {
    bankName: account.bankName,
    accountType: account.accountType,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    bankDescription: account.bankDescription,
    branch: account.branch,
    ifscCode: account.ifscCode,
    openingBalance: String(account.openingBalance ?? 0),
    province: account.province,
    city: account.city,
    baranggay: account.baranggay,
    email: account.email,
    mobileNo: account.mobileNo,
    contactPerson: account.contactPerson,
  };
}

function validateForm(values: AccountManagementFormValues, mode: FormMode) {
  const errors: AccountManagementFieldErrors = {};
  const accountNumber = sanitizeAccountNumber(values.accountNumber);
  const mobileNo = sanitizeMobileNumber(values.mobileNo);

  if (!values.bankName.trim()) errors.bankName = "This field is required";
  if (!values.accountType.trim()) errors.accountType = "This field is required";
  if (!values.accountName.trim()) errors.accountName = "This field is required";
  if (!accountNumber) errors.accountNumber = "This field is required";
  if (!values.bankDescription.trim()) errors.bankDescription = "This field is required";
  if (!values.branch.trim()) errors.branch = "This field is required";
  if (!values.ifscCode.trim()) errors.ifscCode = "This field is required";
  if (mode === "create") {
    if (!values.openingBalance.trim()) errors.openingBalance = "This field is required";
    else if (!Number.isFinite(Number(values.openingBalance))) {
      errors.openingBalance = "Opening balance must be a valid amount";
    }
  }
  if (!values.province.trim()) errors.province = "This field is required";
  if (!values.city.trim()) errors.city = "This field is required";
  if (!values.baranggay.trim()) errors.baranggay = "This field is required";
  if (!values.email.trim()) errors.email = "This field is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Email must be valid";
  }
  if (!mobileNo) errors.mobileNo = "This field is required";
  if (!values.contactPerson.trim()) errors.contactPerson = "This field is required";

  return errors;
}

function TextField({
  id,
  label,
  value,
  disabled,
  required,
  type = "text",
  error,
  inputMode,
  maxLength,
  pattern,
  onChange,
}: TextFieldProps) {
  return (
    <div className="grid gap-1.5" data-invalid={Boolean(error) || undefined}>
      <Label htmlFor={id}>
        {label} {required ? <RequiredMark /> : null}
      </Label>
      <Input
        id={id}
        value={value}
        type={type}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        inputMode={inputMode}
        maxLength={maxLength}
        pattern={pattern}
        onChange={(event) => onChange(id, event.target.value)}
      />
      <FieldError message={error} />
    </div>
  );
}

function BankNameSelect({
  bankNames,
  value,
  disabled,
  creating,
  onValueChange,
  onCreateBankName,
}: BankNameSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedBank = bankNames.find((bank) => bank.bankName === value);
  const normalizedQuery = normalizeBankNameInput(query);
  const normalizedQueryKey = normalizedQuery.toLowerCase();
  const visibleBankNames = normalizedQueryKey
    ? bankNames.filter((bank) =>
        normalizeBankNameInput(bank.bankName)
          .toLowerCase()
          .includes(normalizedQueryKey),
      )
    : bankNames;
  const canCreateBankName =
    Boolean(normalizedQuery) && !disabled && !creating;

  function createBankName() {
    if (!canCreateBankName) return;

    onCreateBankName(normalizedQuery);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
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
          <span className="min-w-0 flex-1 truncate text-left">{selectedBank?.bankName || value || "Select bank"}</span>
          {creating ? (
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
            disabled={disabled || creating}
            placeholder="Search or add bank..."
            onValueChange={setQuery}
          />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            {visibleBankNames.length === 0 && !canCreateBankName ? (
              <CommandEmpty>No banks found.</CommandEmpty>
            ) : null}
            {visibleBankNames.length > 0 || canCreateBankName ? (
              <CommandGroup>
                {canCreateBankName ? (
                  <CommandItem
                    key="__create_bank_name"
                    value={`Add ${normalizedQuery}`}
                    onSelect={() => {
                      void createBankName();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="truncate">Add &quot;{normalizedQuery}&quot;</span>
                  </CommandItem>
                ) : null}
                {visibleBankNames.map((bank) => (
                  <CommandItem
                    key={bank.bankName}
                    value={bank.bankName}
                    onSelect={() => {
                      onValueChange(bank.bankName);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === bank.bankName ? "opacity-100" : "opacity-0")} />
                    {bank.bankName}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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

export default function AccountManagementModule() {
  const { data, loading, saving, error, loadAccounts, createAccount, updateAccount } = useAccountManagement();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [accountNameFilter, setAccountNameFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [status, setStatus] = useState<AccountStatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formValues, setFormValues] = useState<AccountManagementFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<AccountManagementFieldErrors>({});
  const [bankNameError, setBankNameError] = useState<string | null>(null);
  const [bankNameSaving, setBankNameSaving] = useState(false);
  const [pendingBankName, setPendingBankName] = useState<string | null>(null);
  const [pendingBankNameMatches, setPendingBankNameMatches] = useState<BankNameMatch[]>([]);
  const [provinceOptions, setProvinceOptions] = useState<PsgcOption[]>([]);
  const [cityOptions, setCityOptions] = useState<PsgcOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<PsgcOption[]>([]);
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

  const activeCount = useMemo(() => data.accounts.filter((account) => account.isActive).length, [data.accounts]);
  const inactiveCount = data.accounts.length - activeCount;
  const totalPages = Math.max(1, data.pagination.totalPages);
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
  const pendingBankNameHasDuplicate = pendingBankNameMatches.some(
    (match) => match.kind === "duplicate",
  );
  const pendingBankNameHasSimilar = pendingBankNameMatches.some(
    (match) => match.kind === "similar",
  );
  const accountQuery = useMemo<AccountManagementQuery>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search,
      status,
      bankName: bankFilter,
      accountType: accountTypeFilter,
      accountName: accountNameFilter,
      createdFrom,
      createdTo,
    }),
    [
      accountNameFilter,
      accountTypeFilter,
      bankFilter,
      createdFrom,
      createdTo,
      page,
      search,
      status,
    ],
  );

  const loadPsgcOptions = useCallback(async (
    kind: "provinces" | "cities" | "barangays",
    filters: { provinceCode?: string; cityCode?: string } = {},
  ) => {
    const seq = psgcSeqRef.current[kind] + 1;
    psgcSeqRef.current[kind] = seq;

    setPsgcLoading((current) => ({ ...current, [kind]: true }));
    setPsgcError(null);

    try {
      const options = await accountManagementApi.getPsgcOptions({ kind, ...filters });
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts(accountQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [accountQuery, loadAccounts]);

  useEffect(() => {
    if (!dialogOpen) return;

    void loadPsgcOptions("provinces");
    void loadPsgcOptions("cities");
  }, [dialogOpen, loadPsgcOptions]);

  useEffect(() => {
    if (!locationCodes.provinceCode || formValues.province) return;
    const province = provinceOptions.find((option) => option.code === locationCodes.provinceCode);
    if (province) {
      setFormValues((current) => ({ ...current, province: province.name }));
    }
  }, [formValues.province, locationCodes.provinceCode, provinceOptions]);

  useEffect(() => {
    if (!locationCodes.cityCode || formValues.city) return;
    const city = cityOptions.find((option) => option.code === locationCodes.cityCode);
    if (city) {
      setFormValues((current) => ({ ...current, city: city.name }));
    }
  }, [cityOptions, formValues.city, locationCodes.cityCode]);

  function updateFormValue(id: keyof AccountManagementFormValues, value: string) {
    const nextValue =
      id === "accountNumber"
        ? sanitizeAccountNumber(value)
        : id === "mobileNo"
          ? sanitizeMobileNumber(value)
          : value;

    setFormValues((current) => ({
      ...current,
      [id]: nextValue,
    }));
    setFormErrors((current) => ({ ...current, [id]: undefined }));
    setFormError(null);
  }

  function openCreateDialog() {
    setFormMode("create");
    setEditingAccount(null);
    setFormValues(emptyForm);
    setFormError(null);
    setFormErrors({});
    setBankNameError(null);
    setPendingBankName(null);
    setPendingBankNameMatches([]);
    setPsgcError(null);
    setLocationCodes({ provinceCode: "", cityCode: "", barangayCode: "" });
    setDialogOpen(true);
  }

  function openEditDialog(account: BankAccount) {
    setFormMode("edit");
    setEditingAccount(account);
    setFormValues(accountToForm(account));
    setFormError(null);
    setFormErrors({});
    setBankNameError(null);
    setPendingBankName(null);
    setPendingBankNameMatches([]);
    setPsgcError(null);
    setLocationCodes({ provinceCode: "", cityCode: "", barangayCode: "" });
    setDialogOpen(true);
  }

  function selectProvince(option: PsgcOption) {
    setLocationCodes({
      provinceCode: option.code,
      cityCode: "",
      barangayCode: "",
    });
    setFormValues((current) => ({
      ...current,
      province: option.name,
      city: "",
      baranggay: "",
    }));
    setFormErrors((current) => ({
      ...current,
      province: undefined,
      city: undefined,
      baranggay: undefined,
    }));
    void loadPsgcOptions("cities", { provinceCode: option.code });
    void loadPsgcOptions("barangays", { provinceCode: option.code });
  }

  function selectCity(option: PsgcOption) {
    const province = provinceOptions.find((item) => item.code === option.provinceCode);

    setLocationCodes({
      provinceCode: option.provinceCode || "",
      cityCode: option.code,
      barangayCode: "",
    });
    setFormValues((current) => ({
      ...current,
      province: province?.name || "",
      city: option.name,
      baranggay: "",
    }));
    setFormErrors((current) => ({
      ...current,
      province: undefined,
      city: undefined,
      baranggay: undefined,
    }));
    if (option.provinceCode) {
      void loadPsgcOptions("cities", { provinceCode: option.provinceCode });
    }
    void loadPsgcOptions("barangays", { cityCode: option.code });
  }

  function selectBarangay(option: PsgcOption) {
    const city = cityOptions.find((item) => item.code === option.cityCode);
    const province = provinceOptions.find((item) => item.code === (city?.provinceCode || option.provinceCode));

    setLocationCodes({
      provinceCode: city?.provinceCode || option.provinceCode || "",
      cityCode: city?.code || option.cityCode || "",
      barangayCode: option.code,
    });
    setFormValues((current) => ({
      ...current,
      province: province?.name || current.province,
      city: city?.name || current.city,
      baranggay: option.name,
    }));
    setFormErrors((current) => ({
      ...current,
      province: undefined,
      city: undefined,
      baranggay: undefined,
    }));
  }

  function loadBarangaysForCurrentLocation() {
    if (locationCodes.cityCode) {
      void loadPsgcOptions("barangays", { cityCode: locationCodes.cityCode });
      return;
    }

    if (locationCodes.provinceCode) {
      void loadPsgcOptions("barangays", { provinceCode: locationCodes.provinceCode });
      return;
    }

    if (barangayOptions.length === 0) {
      void loadPsgcOptions("barangays");
    }
  }

  async function reloadCurrentPage() {
    await loadAccounts(accountQuery);
  }

  function requestBankNameCreate(bankNameInput: string) {
    const bankName = normalizeBankNameInput(bankNameInput);

    if (!bankName) {
      setBankNameError("Bank name is required");
      return;
    }

    setBankNameError(null);
    setPendingBankName(bankName);
    setPendingBankNameMatches(findSimilarBankNames(bankName, data.bankNames));
  }

  async function confirmBankNameCreate() {
    if (!pendingBankName) return;

    const shouldAllowDuplicate = pendingBankNameMatches.some(
      (match) => match.kind === "duplicate",
    );

    try {
      setBankNameSaving(true);
      setBankNameError(null);
      const result = await accountManagementApi.createBankName(
        pendingBankName,
        shouldAllowDuplicate,
      );
      updateFormValue("bankName", result.bankName || pendingBankName);
      setPendingBankName(null);
      setPendingBankNameMatches([]);
      toast.success("Bank name added");
      await reloadCurrentPage();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add bank name";
      setBankNameError(message);
      toast.error(message);
    } finally {
      setBankNameSaving(false);
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(formValues, formMode);
    if (hasFieldErrors(validationError)) {
      setFormErrors(validationError);
      setFormError("Please review the highlighted fields.");
      return;
    }

    const normalizedValues = {
      ...formValues,
      accountNumber: sanitizeAccountNumber(formValues.accountNumber),
      mobileNo: sanitizeMobileNumber(formValues.mobileNo),
    };
    const saved = formMode === "create"
      ? await createAccount(normalizedValues)
      : editingAccount
        ? await updateAccount(editingAccount.bankId, normalizedValues)
        : { ok: false, message: "No account selected", fieldErrors: undefined };

    if (!saved.ok) {
      setFormError(saved.message);
      setFormErrors(saved.fieldErrors ?? {});
      return;
    }

    setDialogOpen(false);
    if (formMode === "create") setPage(1);
    await loadAccounts({
      page: formMode === "create" ? 1 : page,
      pageSize: PAGE_SIZE,
      search,
      status,
      bankName: bankFilter,
      accountType: accountTypeFilter,
      accountName: accountNameFilter,
      createdFrom,
      createdTo,
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal">Account Management</h1>
            <p className="text-sm text-muted-foreground">
              Register and maintain corporate bank accounts used by treasury operations.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{data.pagination.total.toLocaleString()} accounts</Badge>
          <Badge variant="secondary">{activeCount} active</Badge>
          <Badge variant="outline">{inactiveCount} inactive</Badge>
        </div>
      </div>

      <Card className="rounded-md">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="grid gap-1.5">
                <Label htmlFor="account-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="account-search"
                    value={search}
                    disabled={saving}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Bank, account, branch, or contact"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Bank</Label>
                <SearchableSelect
                  value={bankFilter}
                  disabled={saving}
                  onValueChange={(value) => {
                    setBankFilter(value || "");
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "All banks" },
                    ...data.bankNames.map((bank) => ({
                      value: bank.bankName,
                      label: bank.bankName,
                    })),
                  ]}
                  placeholder="All banks"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Account Type</Label>
                <SearchableSelect
                  value={accountTypeFilter}
                  disabled={saving}
                  onValueChange={(value) => {
                    setAccountTypeFilter(value || "");
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "All types" },
                    ...ACCOUNT_TYPE_OPTIONS.map((accountType) => ({
                      value: accountType,
                      label: accountType,
                    })),
                  ]}
                  placeholder="All types"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <SearchableSelect
                  value={status}
                  disabled={saving}
                  onValueChange={(value) => {
                    setStatus((value || "all") as AccountStatusFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All accounts" },
                    { value: "active", label: "Active only" },
                    { value: "inactive", label: "Inactive only" },
                  ]}
                  placeholder="All accounts"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-created-from">Created From</Label>
                <Input
                  id="account-created-from"
                  type="date"
                  value={createdFrom}
                  disabled={saving}
                  onChange={(event) => {
                    setCreatedFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-created-to">Created To</Label>
                <Input
                  id="account-created-to"
                  type="date"
                  value={createdTo}
                  disabled={saving}
                  onChange={(event) => {
                    setCreatedTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="grid gap-1.5 md:col-span-2 xl:col-span-2">
                <Label htmlFor="account-name-filter">Registered Business Name / Account Name</Label>
                <Input
                  id="account-name-filter"
                  value={accountNameFilter}
                  disabled={saving}
                  onChange={(event) => {
                    setAccountNameFilter(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search registered business or account name"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving || loading}
                onClick={() => {
                  setSearch("");
                  setBankFilter("");
                  setAccountTypeFilter("");
                  setAccountNameFilter("");
                  setCreatedFrom("");
                  setCreatedTo("");
                  setStatus("all");
                  setPage(1);
                }}
              >
                <FilterX />
                Reset
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void reloadCurrentPage()}>
                <RefreshCw />
                Refresh
              </Button>
              <Button type="button" onClick={openCreateDialog}>
                <Plus />
                New Account
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="border-b px-4 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          <div className="w-full overflow-hidden [&_[data-slot=table-container]]:!overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[14%]">Bank</TableHead>
                  <TableHead className="w-[16%]">Registered Account</TableHead>
                  <TableHead className="w-[10%]">Account No.</TableHead>
                  <TableHead className="w-[14%]">Branch</TableHead>
                  <TableHead className="w-[8%]">Routing</TableHead>
                  <TableHead className="w-[10%] text-right">Balance</TableHead>
                  <TableHead className="w-[18%]">Contact</TableHead>
                  <TableHead className="w-10 px-1 text-center">Active</TableHead>
                  <TableHead className="w-10 px-1 text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      Loading bank accounts...
                    </TableCell>
                  </TableRow>
                ) : data.accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      No bank accounts found.
                    </TableCell>
                  </TableRow>
                ) : data.accounts.map((account) => (
                  <TableRow key={account.bankId}>
                    <TableCell className="min-w-0 overflow-hidden align-top">
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={account.bankName || "N/A"}>{account.bankName || "N/A"}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={account.bankDescription || "No description"}>
                          {account.bankDescription || "No description"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top">
                      <div className="line-clamp-2" title={account.accountName || "N/A"}>{account.accountName || "N/A"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {account.accountType || "No account type"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top font-mono text-sm">
                      <span className="block truncate" title={account.accountNumber || "N/A"}>{account.accountNumber || "N/A"}</span>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top">
                      <div className="truncate" title={account.branch || "N/A"}>{account.branch || "N/A"}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={[account.city, account.province].filter(Boolean).join(", ") || "No location"}>
                        {[account.city, account.province].filter(Boolean).join(", ") || "No location"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top">
                      <span className="block truncate" title={account.ifscCode || "N/A"}>{account.ifscCode || "N/A"}</span>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top text-right tabular-nums">
                      <span className="block truncate" title={formatMoney(account.openingBalance)}>
                        {formatMoney(account.openingBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 overflow-hidden align-top">
                      <div className="truncate" title={account.contactPerson || "N/A"}>{account.contactPerson || "N/A"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground" title={account.mobileNo || "No mobile"}>{account.mobileNo || "No mobile"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground" title={account.email || "No email"}>{account.email || "No email"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(account.createdAt)}</div>
                    </TableCell>
                    <TableCell className="px-1 align-top text-center">
                      <Switch
                        checked={account.isActive}
                        disabled={saving}
                        size="sm"
                        onCheckedChange={async (checked) => {
                          const saved = await updateAccount(account.bankId, { isActive: checked });
                          if (saved.ok) await reloadCurrentPage();
                        }}
                        aria-label={`Toggle ${account.bankName} active status`}
                      />
                    </TableCell>
                    <TableCell className="px-1 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={saving}
                        onClick={() => openEditDialog(account)}
                        aria-label={`Edit ${account.bankName} account`}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {data.pagination.total === 0
                ? "0 accounts"
                : `${((data.pagination.page - 1) * data.pagination.pageSize) + 1}-${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of ${data.pagination.total} accounts`}
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    aria-disabled={page <= 1 || saving}
                    aria-label={page <= 1 ? "No previous page" : "Previous page"}
                    className={cn((page <= 1 || saving) && "pointer-events-none opacity-50")}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!saving) setPage((current) => Math.max(1, current - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm tabular-nums text-muted-foreground">
                    {data.pagination.page} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    aria-disabled={page >= totalPages || saving}
                    aria-label={page >= totalPages ? "No next page" : "Next page"}
                    className={cn((page >= totalPages || saving) && "pointer-events-none opacity-50")}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!saving) setPage((current) => Math.min(totalPages, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-4xl flex-col overflow-hidden p-0">
          <form onSubmit={submitForm} className="flex min-h-0 max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b p-6 pb-4">
              <DialogTitle>{formMode === "create" ? "New Bank Account" : "Edit Bank Account"}</DialogTitle>
              <DialogDescription>
                {formMode === "create" ? "Create a corporate bank account record." : "Update corporate bank account details."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto overscroll-contain p-6">
              {formError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              {psgcError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {psgcError}
                </div>
              ) : null}

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Account Details</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(bankNameError || formErrors.bankName) || undefined}>
                    <Label>
                      Bank Name <RequiredMark />
                    </Label>
                    <BankNameSelect
                      bankNames={data.bankNames}
                      value={formValues.bankName}
                      disabled={saving || bankNameSaving}
                      creating={bankNameSaving}
                      onValueChange={(value) => {
                        setBankNameError(null);
                        setFormErrors((current) => ({ ...current, bankName: undefined }));
                        updateFormValue("bankName", value);
                      }}
                      onCreateBankName={requestBankNameCreate}
                    />
                    <FieldError message={bankNameError || formErrors.bankName} />
                  </div>
                  <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.accountType) || undefined}>
                    <Label>
                      Account Type <RequiredMark />
                    </Label>
                    <SearchableSelect
                      value={formValues.accountType}
                      disabled={saving}
                      onValueChange={(value) => updateFormValue("accountType", value)}
                      options={ACCOUNT_TYPE_OPTIONS.map((accountType) => ({
                        value: accountType,
                        label: accountType,
                      }))}
                      placeholder="Select account type"
                    />
                    <FieldError message={formErrors.accountType} />
                  </div>
                  <TextField
                    id="accountName"
                    label="Registered Business Name / Account Name"
                    value={formValues.accountName}
                    disabled={saving}
                    required
                    error={formErrors.accountName}
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="accountNumber"
                    label="Account Number"
                    value={formValues.accountNumber}
                    disabled={saving}
                    required
                    error={formErrors.accountNumber}
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="openingBalance"
                    label="Opening Balance"
                    value={formValues.openingBalance}
                    disabled={saving || formMode === "edit"}
                    required={formMode === "create"}
                    type="number"
                    error={formErrors.openingBalance}
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="ifscCode"
                    label="IFSC / Routing Code"
                    value={formValues.ifscCode}
                    disabled={saving}
                    required
                    error={formErrors.ifscCode}
                    onChange={updateFormValue}
                  />
                  <div className="grid gap-1.5 md:col-span-2" data-invalid={Boolean(formErrors.bankDescription) || undefined}>
                    <Label htmlFor="bankDescription">
                      Bank Description <RequiredMark />
                    </Label>
                    <Textarea
                      id="bankDescription"
                      value={formValues.bankDescription}
                      disabled={saving}
                      aria-invalid={Boolean(formErrors.bankDescription)}
                      onChange={(event) => updateFormValue("bankDescription", event.target.value)}
                    />
                    <FieldError message={formErrors.bankDescription} />
                  </div>
                </div>
              </section>

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Branch Location</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    id="branch"
                    label="Branch Name"
                    value={formValues.branch}
                    disabled={saving}
                    required
                    error={formErrors.branch}
                    onChange={updateFormValue}
                  />
                  <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.province) || undefined}>
                    <Label>
                      Province <RequiredMark />
                    </Label>
                    <PsgcSelect
                      options={displayedProvinceOptions}
                      value={formValues.province}
                      disabled={saving || psgcLoading.provinces || displayedProvinceOptions.length === 0}
                      loading={psgcLoading.provinces}
                      placeholder="Select province"
                      searchPlaceholder="Search province..."
                      emptyText="No provinces found."
                      onSelect={selectProvince}
                    />
                    <FieldError message={formErrors.province} />
                  </div>
                  <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.city) || undefined}>
                    <Label>
                      City / Municipality <RequiredMark />
                    </Label>
                    <PsgcSelect
                      options={displayedCityOptions}
                      value={formValues.city}
                      disabled={saving || psgcLoading.cities || displayedCityOptions.length === 0}
                      loading={psgcLoading.cities}
                      placeholder="Select city or municipality"
                      searchPlaceholder="Search city or municipality..."
                      emptyText="No cities or municipalities found."
                      onSelect={selectCity}
                    />
                    <FieldError message={formErrors.city} />
                  </div>
                  <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.baranggay) || undefined}>
                    <Label>
                      Barangay <RequiredMark />
                    </Label>
                    <PsgcSelect
                      options={barangayOptions}
                      value={formValues.baranggay}
                      disabled={saving || psgcLoading.barangays || psgcLoading.cities}
                      loading={psgcLoading.barangays}
                      placeholder="Select barangay"
                      searchPlaceholder="Search barangay..."
                      emptyText="No barangays found."
                      onOpen={loadBarangaysForCurrentLocation}
                      onSelect={selectBarangay}
                    />
                    <FieldError message={formErrors.baranggay} />
                  </div>
                </div>
              </section>

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Contact Info</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    id="contactPerson"
                    label="Contact Person"
                    value={formValues.contactPerson}
                    disabled={saving}
                    required
                    error={formErrors.contactPerson}
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="email"
                    label="Email"
                    value={formValues.email}
                    disabled={saving}
                    required
                    type="email"
                    inputMode="email"
                    error={formErrors.email}
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="mobileNo"
                    label="Mobile No."
                    value={formValues.mobileNo}
                    disabled={saving}
                    required
                    inputMode="numeric"
                    maxLength={20}
                    pattern="[0-9]*"
                    error={formErrors.mobileNo}
                    onChange={updateFormValue}
                  />
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 border-t p-6 pt-4">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {formMode === "create" ? "Create Account" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingBankName)}
        onOpenChange={(open) => {
          if (bankNameSaving) return;
          if (!open) {
            setPendingBankName(null);
            setPendingBankNameMatches([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBankNameHasDuplicate
                ? "Bank name already exists"
                : pendingBankNameHasSimilar
                  ? "Similar bank names found"
                  : "Add bank name?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBankNameHasDuplicate || pendingBankNameHasSimilar
                ? `Review the existing bank names before adding "${pendingBankName}".`
                : `Are you sure you want to add "${pendingBankName}" to the bank names list?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingBankNameMatches.length > 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-2 font-medium">Existing matches</p>
              <ul className="grid gap-1">
                {pendingBankNameMatches.map((match) => (
                  <li key={`${match.kind}-${match.bankName}`} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{match.bankName}</span>
                    <Badge variant={match.kind === "duplicate" ? "destructive" : "secondary"}>
                      {match.kind === "duplicate" ? "Duplicate" : "Similar"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bankNameSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bankNameSaving}
              onClick={(event) => {
                event.preventDefault();
                void confirmBankNameCreate();
              }}
            >
              {bankNameSaving ? <Loader2 className="animate-spin" /> : null}
              Add Bank Name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
