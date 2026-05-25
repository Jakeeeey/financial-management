// src/modules/financial-management/treasury/bank-management/account-management/AccountManagementModule.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, FilterX, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
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
import { useAccountManagement } from "./hooks/useAccountManagement";
import type {
  AccountManagementFormValues,
  AccountStatusFilter,
  BankAccount,
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

  const activeCount = useMemo(() => data.accounts.filter((account) => account.isActive).length, [data.accounts]);
  const inactiveCount = data.accounts.length - activeCount;
  const totalPages = Math.max(1, data.pagination.totalPages);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts({ page, pageSize: PAGE_SIZE, search, status });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadAccounts, page, search, status]);

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
    setDialogOpen(true);
  }

  function openEditDialog(account: BankAccount) {
    setFormMode("edit");
    setEditingAccount(account);
    setFormValues(accountToForm(account));
    setFormError(null);
    setDialogOpen(true);
  }

  async function reloadCurrentPage() {
    await loadAccounts({ page, pageSize: PAGE_SIZE, search, status });
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

              <section className="grid gap-4">
                <h2 className="text-sm font-semibold">Account Details</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Bank Name *</Label>
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
                  <TextField id="province" label="Province" value={formValues.province} disabled={saving} onChange={updateFormValue} />
                  <TextField id="city" label="City" value={formValues.city} disabled={saving} onChange={updateFormValue} />
                  <TextField id="baranggay" label="Baranggay" value={formValues.baranggay} disabled={saving} onChange={updateFormValue} />
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
    </div>
  );
}
