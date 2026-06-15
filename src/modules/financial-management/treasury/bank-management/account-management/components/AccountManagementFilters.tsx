import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FilterX, Plus, RefreshCw, Search } from "lucide-react";
import type { AccountStatusFilter, AccountTypeOption, BankNameOption } from "../types";

type AccountManagementFiltersProps = {
  search: string;
  bankFilter: string;
  accountTypeFilter: string;
  accountNameFilter: string;
  createdFrom: string;
  createdTo: string;
  status: AccountStatusFilter;
  bankNames: BankNameOption[];
  accountTypes: AccountTypeOption[];
  saving: boolean;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onBankFilterChange: (value: string) => void;
  onAccountTypeFilterChange: (value: string) => void;
  onAccountNameFilterChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onStatusChange: (value: AccountStatusFilter) => void;
  onReset: () => void;
  onRefresh: () => void;
  onCreateAccount: () => void;
};

export function AccountManagementFilters({
  search,
  bankFilter,
  accountTypeFilter,
  accountNameFilter,
  createdFrom,
  createdTo,
  status,
  bankNames,
  accountTypes,
  saving,
  loading,
  onSearchChange,
  onBankFilterChange,
  onAccountTypeFilterChange,
  onAccountNameFilterChange,
  onCreatedFromChange,
  onCreatedToChange,
  onStatusChange,
  onReset,
  onRefresh,
  onCreateAccount,
}: AccountManagementFiltersProps) {
  return (
    <CardHeader className="gap-3 border-b">
      <div className="grid gap-3">
        <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-1.5">
            <Label htmlFor="account-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="account-search"
                value={search}
                disabled={saving}
                onChange={(event) => onSearchChange(event.target.value)}
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
              onValueChange={(value) => onBankFilterChange(value || "")}
              options={[
                { value: "", label: "All banks" },
                ...bankNames.map((bank) => ({
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
              onValueChange={(value) => onAccountTypeFilterChange(value || "")}
              options={[
                { value: "", label: "All types" },
                ...accountTypes.map((type) => ({
                  value: type.accountType,
                  label: type.accountType,
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
              onValueChange={(value) => onStatusChange((value || "all") as AccountStatusFilter)}
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
              onChange={(event) => onCreatedFromChange(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-created-to">Created To</Label>
            <Input
              id="account-created-to"
              type="date"
              value={createdTo}
              disabled={saving}
              onChange={(event) => onCreatedToChange(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 md:col-span-2 xl:col-span-2">
            <Label htmlFor="account-name-filter">Registered Business Name / Account Name</Label>
            <Input
              id="account-name-filter"
              value={accountNameFilter}
              disabled={saving}
              onChange={(event) => onAccountNameFilterChange(event.target.value)}
              placeholder="Search registered business or account name"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving || loading}
            onClick={onReset}
          >
            <FilterX />
            Reset
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onRefresh}>
            <RefreshCw />
            Refresh
          </Button>
          <Button type="button" onClick={onCreateAccount}>
            <Plus />
            New Account
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
