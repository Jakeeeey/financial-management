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
  AccountManagementFormValues,
  AccountStatusFilter,
  BankAccount,
  PsgcOption,
} from "./types";

const PAGE_SIZE = 10;

const emptyForm: AccountManagementFormValues = {
  bankName: "",
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

type TextFieldProps = {
  id: keyof AccountManagementFormValues;
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  onChange: (id: keyof AccountManagementFormValues, value: string) => void;
};

type BankNameSelectProps = {
  bankNames: Array<{ bankName: string }>;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function accountToForm(account: BankAccount): AccountManagementFormValues {
  return {
    bankName: account.bankName,
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
  const accountNumber = sanitizeAccountNumber(values.accountNumber);
  if (!values.bankName.trim()) return "Bank name is required";
  if (!accountNumber) return "Account number is required";
  if (!values.branch.trim()) return "Branch is required";
  if (mode === "create") {
    if (!values.openingBalance.trim()) return "Opening balance is required";
    if (!Number.isFinite(Number(values.openingBalance))) return "Opening balance must be a valid amount";
  }
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return "Email must be valid";
  }
  return null;
}

function TextField({
  id,
  label,
  value,
  disabled,
  required,
  type = "text",
  onChange,
}: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        value={value}
        type={type}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </div>
  );
}

function BankNameSelect({
  bankNames,
  value,
  disabled,
  onValueChange,
}: BankNameSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedBank = bankNames.find((bank) => bank.bankName === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedBank?.bankName || "Select bank"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search bank..." />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No banks found.</CommandEmpty>
            <CommandGroup>
              {bankNames.map((bank) => (
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
  const [status, setStatus] = useState<AccountStatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formValues, setFormValues] = useState<AccountManagementFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [bankNameDialogOpen, setBankNameDialogOpen] = useState(false);
  const [bankNameInput, setBankNameInput] = useState("");
  const [bankNameError, setBankNameError] = useState<string | null>(null);
  const [bankNameSaving, setBankNameSaving] = useState(false);
  const [duplicateBankName, setDuplicateBankName] = useState<string | null>(null);
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
      void loadAccounts({ page, pageSize: PAGE_SIZE, search, status });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadAccounts, page, search, status]);

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
    setFormValues((current) => ({
      ...current,
      [id]: id === "accountNumber" ? sanitizeAccountNumber(value) : value,
    }));
  }

  function openCreateDialog() {
    setFormMode("create");
    setEditingAccount(null);
    setFormValues(emptyForm);
    setFormError(null);
    setPsgcError(null);
    setLocationCodes({ provinceCode: "", cityCode: "", barangayCode: "" });
    setDialogOpen(true);
  }

  function openEditDialog(account: BankAccount) {
    setFormMode("edit");
    setEditingAccount(account);
    setFormValues(accountToForm(account));
    setFormError(null);
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
    await loadAccounts({ page, pageSize: PAGE_SIZE, search, status });
  }

  function openBankNameDialog() {
    setBankNameInput("");
    setBankNameError(null);
    setDuplicateBankName(null);
    setBankNameDialogOpen(true);
  }

  async function submitBankName(allowDuplicate = false) {
    const bankName = bankNameInput.trim().replace(/\s+/g, " ");

    if (!bankName) {
      setBankNameError("Bank name is required");
      return;
    }

    try {
      setBankNameSaving(true);
      setBankNameError(null);
      const result = await accountManagementApi.createBankName(
        bankName,
        allowDuplicate,
      );

      if (result.status === "duplicate") {
        setDuplicateBankName(result.bankName);
        return;
      }

      updateFormValue("bankName", result.bankName.bankName || bankName);
      setBankNameInput("");
      setBankNameDialogOpen(false);
      setDuplicateBankName(null);
      toast.success("Bank name added");
      await reloadCurrentPage();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add bank name";
      setDuplicateBankName(null);
      setBankNameError(message);
      toast.error(message);
    } finally {
      setBankNameSaving(false);
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(formValues, formMode);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const normalizedValues = {
      ...formValues,
      accountNumber: sanitizeAccountNumber(formValues.accountNumber),
    };
    const saved = formMode === "create"
      ? await createAccount(normalizedValues)
      : editingAccount
        ? await updateAccount(editingAccount.bankId, normalizedValues)
        : false;

    if (!saved) return;

    setDialogOpen(false);
    if (formMode === "create") setPage(1);
    await loadAccounts({
      page: formMode === "create" ? 1 : page,
      pageSize: PAGE_SIZE,
      search,
      status,
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
            <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_220px] lg:max-w-3xl">
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
                    placeholder="Bank, account number, branch, or contact"
                    className="pl-8"
                  />
                </div>
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
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving || loading}
                onClick={() => {
                  setSearch("");
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
          <div className="overflow-x-auto">
            <Table className="min-w-245 table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">Bank</TableHead>
                  <TableHead className="w-[15%]">Account Number</TableHead>
                  <TableHead className="w-[16%]">Branch</TableHead>
                  <TableHead className="w-[13%]">Routing</TableHead>
                  <TableHead className="w-[13%] text-right">Opening Balance</TableHead>
                  <TableHead className="w-[15%]">Contact</TableHead>
                  <TableHead className="w-[5%] text-center">Active</TableHead>
                  <TableHead className="sticky right-0 z-10 w-[5%] bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      Loading bank accounts...
                    </TableCell>
                  </TableRow>
                ) : data.accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      No bank accounts found.
                    </TableCell>
                  </TableRow>
                ) : data.accounts.map((account) => (
                  <TableRow key={account.bankId}>
                    <TableCell className="min-w-0 whitespace-normal">
                      <div className="min-w-0">
                        <div className="wrap-break-word font-medium">{account.bankName || "N/A"}</div>
                        <div className="mt-1 wrap-break-word text-xs text-muted-foreground">
                          {account.bankDescription || "No description"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="wrap-break-word font-mono text-sm">{account.accountNumber || "N/A"}</TableCell>
                    <TableCell className="whitespace-normal wrap-break-word">
                      <div>{account.branch || "N/A"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[account.city, account.province].filter(Boolean).join(", ") || "No location"}
                      </div>
                    </TableCell>
                    <TableCell className="wrap-break-word">{account.ifscCode || "N/A"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(account.openingBalance)}</TableCell>
                    <TableCell className="whitespace-normal wrap-break-word">
                      <div>{account.contactPerson || "N/A"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{account.mobileNo || account.email || "No contact"}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={account.isActive}
                        disabled={saving}
                        onCheckedChange={async (checked) => {
                          const saved = await updateAccount(account.bankId, { isActive: checked });
                          if (saved) await reloadCurrentPage();
                        }}
                        aria-label={`Toggle ${account.bankName} active status`}
                      />
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
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
                  <div className="grid min-w-0 gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Bank Name *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={saving || bankNameSaving}
                        onClick={openBankNameDialog}
                      >
                        <Plus />
                        Add bank
                      </Button>
                    </div>
                    <BankNameSelect
                      bankNames={data.bankNames}
                      value={formValues.bankName}
                      disabled={saving}
                      onValueChange={(value) => updateFormValue("bankName", value)}
                    />
                  </div>
                  <TextField
                    id="accountNumber"
                    label="Account Number"
                    value={formValues.accountNumber}
                    disabled={saving}
                    required
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="openingBalance"
                    label="Opening Balance"
                    value={formValues.openingBalance}
                    disabled={saving || formMode === "edit"}
                    required={formMode === "create"}
                    type="number"
                    onChange={updateFormValue}
                  />
                  <TextField
                    id="ifscCode"
                    label="IFSC / Routing Code"
                    value={formValues.ifscCode}
                    disabled={saving}
                    onChange={updateFormValue}
                  />
                  <div className="grid gap-1.5 md:col-span-2">
                    <Label htmlFor="bankDescription">Bank Description</Label>
                    <Textarea
                      id="bankDescription"
                      value={formValues.bankDescription}
                      disabled={saving}
                      onChange={(event) => updateFormValue("bankDescription", event.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Branch Location</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField id="branch" label="Branch Name" value={formValues.branch} disabled={saving} required onChange={updateFormValue} />
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Province</Label>
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
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label>City / Municipality</Label>
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
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Barangay</Label>
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
                  </div>
                </div>
              </section>

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Contact Info</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField id="contactPerson" label="Contact Person" value={formValues.contactPerson} disabled={saving} onChange={updateFormValue} />
                  <TextField id="email" label="Email" value={formValues.email} disabled={saving} type="email" onChange={updateFormValue} />
                  <TextField id="mobileNo" label="Mobile No." value={formValues.mobileNo} disabled={saving} onChange={updateFormValue} />
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

      <Dialog
        open={bankNameDialogOpen}
        onOpenChange={(open) => {
          if (bankNameSaving) return;
          setBankNameDialogOpen(open);
          if (!open) {
            setBankNameError(null);
            setDuplicateBankName(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitBankName();
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Add Bank Name</DialogTitle>
              <DialogDescription>
                Add a bank name to the selectable bank list.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="newBankName">Bank Name *</Label>
              <Input
                id="newBankName"
                value={bankNameInput}
                disabled={bankNameSaving}
                autoComplete="off"
                onChange={(event) => setBankNameInput(event.target.value)}
              />
              {bankNameError ? (
                <p className="text-sm text-destructive">{bankNameError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={bankNameSaving}
                onClick={() => setBankNameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={bankNameSaving}>
                {bankNameSaving ? <Loader2 className="animate-spin" /> : null}
                Add Bank Name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(duplicateBankName)}
        onOpenChange={(open) => {
          if (!open && !bankNameSaving) setDuplicateBankName(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bank name already exists</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateBankName} is already in the bank names list. Do you
              still want to add another record with this bank name?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bankNameSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bankNameSaving}
              onClick={(event) => {
                event.preventDefault();
                void submitBankName(true);
              }}
            >
              {bankNameSaving ? <Loader2 className="animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
