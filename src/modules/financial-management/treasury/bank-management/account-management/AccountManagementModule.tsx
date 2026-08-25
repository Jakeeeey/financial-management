"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AccountFormDialog } from "./components/AccountFormDialog";
import { AccountManagementFilters } from "./components/AccountManagementFilters";
import { AccountManagementTable } from "./components/AccountManagementTable";
import { CreateOptionDialog } from "./components/CreateOptionDialog";
import {
  compactOptionKey,
  normalizeOptionInput,
  normalizeOptionKey,
  sanitizeAccountNumber,
  sanitizeMobileNumber,
} from "./components/utils";
import { useAccountManagement } from "./hooks/useAccountManagement";
import { accountManagementApi } from "./providers/accountManagementApi";
import type {
  AccountManagementFieldErrors,
  AccountManagementFormMode,
  AccountManagementFormValues,
  AccountManagementQuery,
  AccountStatusFilter,
  BankAccount,
  PsgcOption,
} from "./types";

const PAGE_SIZE = 10;

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

type BankNameMatch = {
  bankName: string;
  kind: "duplicate" | "similar";
};

type AccountTypeMatch = {
  accountType: string;
  kind: "duplicate" | "similar";
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

function hasFieldErrors(errors: AccountManagementFieldErrors) {
  return Object.values(errors).some(Boolean);
}

function findSimilarBankNames(
  bankName: string,
  bankNames: Array<{ bankName: string }>,
): BankNameMatch[] {
  const normalizedName = normalizeOptionKey(bankName);
  const compactName = compactOptionKey(bankName);
  if (!normalizedName) return [];

  return bankNames
    .map((bank) => {
      const existingName = normalizeOptionKey(bank.bankName);
      const existingCompact = compactOptionKey(bank.bankName);

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

function findSimilarAccountTypes(
  accountType: string,
  accountTypes: Array<{ accountType: string }>,
): AccountTypeMatch[] {
  const normalizedName = normalizeOptionKey(accountType);
  const compactName = compactOptionKey(accountType);
  if (!normalizedName) return [];

  return accountTypes
    .map((type) => {
      const existingName = normalizeOptionKey(type.accountType);
      const existingCompact = compactOptionKey(type.accountType);

      if (existingName === normalizedName || existingCompact === compactName) {
        return { accountType: type.accountType, kind: "duplicate" } as const;
      }

      const isSimilar =
        compactName.length >= 4 &&
        existingCompact.length >= 4 &&
        (existingCompact.includes(compactName) ||
          compactName.includes(existingCompact));

      return isSimilar
        ? ({ accountType: type.accountType, kind: "similar" } as const)
        : null;
    })
    .filter((match): match is AccountTypeMatch => Boolean(match))
    .sort((first, second) => {
      if (first.kind === second.kind) return 0;
      return first.kind === "duplicate" ? -1 : 1;
    })
    .slice(0, 5);
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
    mobileNo: sanitizeMobileNumber(account.mobileNo),
    contactPerson: account.contactPerson,
  };
}

function validateForm(values: AccountManagementFormValues, mode: AccountManagementFormMode) {
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
  else if (values.mobileNo !== mobileNo)
    errors.mobileNo = "Mobile No. must contain numbers only";
  if (!values.contactPerson.trim()) errors.contactPerson = "This field is required";

  return errors;
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
  const [formMode, setFormMode] = useState<AccountManagementFormMode>("create");
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formValues, setFormValues] = useState<AccountManagementFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<AccountManagementFieldErrors>({});
  const [bankNameError, setBankNameError] = useState<string | null>(null);
  const [bankNameSaving, setBankNameSaving] = useState(false);
  const [pendingBankName, setPendingBankName] = useState<string | null>(null);
  const [pendingBankNameMatches, setPendingBankNameMatches] = useState<BankNameMatch[]>([]);
  const [accountTypeError, setAccountTypeError] = useState<string | null>(null);
  const [accountTypeSaving, setAccountTypeSaving] = useState(false);
  const [pendingAccountType, setPendingAccountType] = useState<string | null>(null);
  const [pendingAccountTypeMatches, setPendingAccountTypeMatches] = useState<AccountTypeMatch[]>([]);
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
    setAccountTypeError(null);
    setPendingAccountType(null);
    setPendingAccountTypeMatches([]);
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
    setAccountTypeError(null);
    setPendingAccountType(null);
    setPendingAccountTypeMatches([]);
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
    const bankName = normalizeOptionInput(bankNameInput);

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

  function requestAccountTypeCreate(accountTypeInput: string) {
    const accountType = normalizeOptionInput(accountTypeInput);

    if (!accountType) {
      setAccountTypeError("Account type is required");
      return;
    }

    setAccountTypeError(null);
    setPendingAccountType(accountType);
    setPendingAccountTypeMatches(findSimilarAccountTypes(accountType, data.accountTypes));
  }

  async function confirmAccountTypeCreate() {
    if (!pendingAccountType) return;

    const shouldAllowDuplicate = pendingAccountTypeMatches.some(
      (match) => match.kind === "duplicate",
    );

    try {
      setAccountTypeSaving(true);
      setAccountTypeError(null);
      const result = await accountManagementApi.createAccountType(
        pendingAccountType,
        shouldAllowDuplicate,
      );
      updateFormValue("accountType", result.accountType || pendingAccountType);
      setPendingAccountType(null);
      setPendingAccountTypeMatches([]);
      toast.success("Account type added");
      await reloadCurrentPage();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add account type";
      setAccountTypeError(message);
      toast.error(message);
    } finally {
      setAccountTypeSaving(false);
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
        <AccountManagementFilters
          search={search}
          bankFilter={bankFilter}
          accountTypeFilter={accountTypeFilter}
          accountNameFilter={accountNameFilter}
          createdFrom={createdFrom}
          createdTo={createdTo}
          status={status}
          bankNames={data.bankNames}
          accountTypes={data.accountTypes}
          saving={saving}
          loading={loading}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onBankFilterChange={(value) => {
            setBankFilter(value);
            setPage(1);
          }}
          onAccountTypeFilterChange={(value) => {
            setAccountTypeFilter(value);
            setPage(1);
          }}
          onAccountNameFilterChange={(value) => {
            setAccountNameFilter(value);
            setPage(1);
          }}
          onCreatedFromChange={(value) => {
            setCreatedFrom(value);
            setPage(1);
          }}
          onCreatedToChange={(value) => {
            setCreatedTo(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          onReset={() => {
            setSearch("");
            setBankFilter("");
            setAccountTypeFilter("");
            setAccountNameFilter("");
            setCreatedFrom("");
            setCreatedTo("");
            setStatus("all");
            setPage(1);
          }}
          onRefresh={() => {
            void reloadCurrentPage();
          }}
          onCreateAccount={openCreateDialog}
        />
        <AccountManagementTable
          accounts={data.accounts}
          pagination={data.pagination}
          page={page}
          totalPages={totalPages}
          loading={loading}
          saving={saving}
          error={error}
          onPageChange={setPage}
          onToggleActive={async (account, checked) => {
            const saved = await updateAccount(account.bankId, { isActive: checked });
            if (saved.ok) await reloadCurrentPage();
          }}
          onEditAccount={openEditDialog}
        />
      </Card>

      <AccountFormDialog
        open={dialogOpen}
        formMode={formMode}
        formValues={formValues}
        formErrors={formErrors}
        formError={formError}
        psgcError={psgcError}
        saving={saving}
        bankNames={data.bankNames}
        accountTypes={data.accountTypes}
        bankNameError={bankNameError}
        bankNameSaving={bankNameSaving}
        accountTypeError={accountTypeError}
        accountTypeSaving={accountTypeSaving}
        provinceOptions={displayedProvinceOptions}
        cityOptions={displayedCityOptions}
        barangayOptions={barangayOptions}
        psgcLoading={psgcLoading}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
        onSubmit={submitForm}
        onValueChange={updateFormValue}
        onBankNameChange={(value) => {
          setBankNameError(null);
          setFormErrors((current) => ({ ...current, bankName: undefined }));
          updateFormValue("bankName", value);
        }}
        onAccountTypeChange={(value) => {
          setAccountTypeError(null);
          setFormErrors((current) => ({ ...current, accountType: undefined }));
          updateFormValue("accountType", value);
        }}
        onCreateBankName={requestBankNameCreate}
        onCreateAccountType={requestAccountTypeCreate}
        onSelectProvince={selectProvince}
        onSelectCity={selectCity}
        onSelectBarangay={selectBarangay}
        onLoadBarangays={loadBarangaysForCurrentLocation}
      />

      <CreateOptionDialog
        open={Boolean(pendingBankName)}
        value={pendingBankName}
        matches={pendingBankNameMatches.map((match) => ({
          value: match.bankName,
          kind: match.kind,
        }))}
        saving={bankNameSaving}
        noun="bank name"
        pluralNoun="bank names"
        confirmLabel="Add Bank Name"
        onOpenChange={(open) => {
          if (bankNameSaving) return;
          if (!open) {
            setPendingBankName(null);
            setPendingBankNameMatches([]);
          }
        }}
        onConfirm={() => {
          void confirmBankNameCreate();
        }}
      />

      <CreateOptionDialog
        open={Boolean(pendingAccountType)}
        value={pendingAccountType}
        matches={pendingAccountTypeMatches.map((match) => ({
          value: match.accountType,
          kind: match.kind,
        }))}
        saving={accountTypeSaving}
        noun="account type"
        pluralNoun="account types"
        confirmLabel="Add Account Type"
        onOpenChange={(open) => {
          if (accountTypeSaving) return;
          if (!open) {
            setPendingAccountType(null);
            setPendingAccountTypeMatches([]);
          }
        }}
        onConfirm={() => {
          void confirmAccountTypeCreate();
        }}
      />
    </div>
  );
}
