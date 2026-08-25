import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import type {
  AccountManagementFieldErrors,
  AccountManagementFormMode,
  AccountManagementFormValues,
  AccountTypeOption,
  BankNameOption,
  PsgcOption,
} from "../types";
import { CreatableCombobox } from "./CreatableCombobox";
import { FieldError, RequiredMark, TextField } from "./FormFields";
import { PsgcSelect } from "./PsgcSelect";

type PsgcLoadingState = {
  provinces: boolean;
  cities: boolean;
  barangays: boolean;
};

type AccountFormDialogProps = {
  open: boolean;
  formMode: AccountManagementFormMode;
  formValues: AccountManagementFormValues;
  formErrors: AccountManagementFieldErrors;
  formError?: string | null;
  psgcError?: string | null;
  saving: boolean;
  bankNames: BankNameOption[];
  accountTypes: AccountTypeOption[];
  bankNameError?: string | null;
  bankNameSaving: boolean;
  accountTypeError?: string | null;
  accountTypeSaving: boolean;
  provinceOptions: PsgcOption[];
  cityOptions: PsgcOption[];
  barangayOptions: PsgcOption[];
  psgcLoading: PsgcLoadingState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (id: keyof AccountManagementFormValues, value: string) => void;
  onBankNameChange: (value: string) => void;
  onAccountTypeChange: (value: string) => void;
  onCreateBankName: (value: string) => void;
  onCreateAccountType: (value: string) => void;
  onSelectProvince: (option: PsgcOption) => void;
  onSelectCity: (option: PsgcOption) => void;
  onSelectBarangay: (option: PsgcOption) => void;
  onLoadBarangays: () => void;
};

export function AccountFormDialog({
  open,
  formMode,
  formValues,
  formErrors,
  formError,
  psgcError,
  saving,
  bankNames,
  accountTypes,
  bankNameError,
  bankNameSaving,
  accountTypeError,
  accountTypeSaving,
  provinceOptions,
  cityOptions,
  barangayOptions,
  psgcLoading,
  onOpenChange,
  onSubmit,
  onValueChange,
  onBankNameChange,
  onAccountTypeChange,
  onCreateBankName,
  onCreateAccountType,
  onSelectProvince,
  onSelectCity,
  onSelectBarangay,
  onLoadBarangays,
}: AccountFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-4xl flex-col overflow-hidden p-0">
        <form onSubmit={onSubmit} className="flex min-h-0 max-h-[calc(100vh-2rem)] flex-col">
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
                  <CreatableCombobox
                    options={bankNames.map((bank) => ({
                      value: bank.bankName,
                      label: bank.bankName,
                    }))}
                    value={formValues.bankName}
                    disabled={saving || bankNameSaving}
                    creating={bankNameSaving}
                    placeholder="Select bank"
                    searchPlaceholder="Search or add bank..."
                    emptyText="No banks found."
                    onValueChange={onBankNameChange}
                    onCreate={onCreateBankName}
                  />
                  <FieldError message={bankNameError || formErrors.bankName} />
                </div>
                <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(accountTypeError || formErrors.accountType) || undefined}>
                  <Label>
                    Account Type <RequiredMark />
                  </Label>
                  <CreatableCombobox
                    options={accountTypes.map((type) => ({
                      value: type.accountType,
                      label: type.accountType,
                    }))}
                    value={formValues.accountType}
                    disabled={saving || accountTypeSaving}
                    creating={accountTypeSaving}
                    placeholder="Select account type"
                    searchPlaceholder="Search or add account type..."
                    emptyText="No account types found."
                    onValueChange={onAccountTypeChange}
                    onCreate={onCreateAccountType}
                  />
                  <FieldError message={accountTypeError || formErrors.accountType} />
                </div>
                <TextField
                  id="accountName"
                  label="Registered Business Name / Account Name"
                  value={formValues.accountName}
                  disabled={saving}
                  required
                  error={formErrors.accountName}
                  onChange={onValueChange}
                />
                <TextField
                  id="accountNumber"
                  label="Account Number"
                  value={formValues.accountNumber}
                  disabled={saving}
                  required
                  error={formErrors.accountNumber}
                  onChange={onValueChange}
                />
                <TextField
                  id="openingBalance"
                  label="Opening Balance"
                  value={formValues.openingBalance}
                  disabled={saving || formMode === "edit"}
                  required={formMode === "create"}
                  type="number"
                  error={formErrors.openingBalance}
                  onChange={onValueChange}
                />
                <TextField
                  id="ifscCode"
                  label="IFSC / Routing Code"
                  value={formValues.ifscCode}
                  disabled={saving}
                  required
                  error={formErrors.ifscCode}
                  onChange={onValueChange}
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
                    onChange={(event) => onValueChange("bankDescription", event.target.value)}
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
                  onChange={onValueChange}
                />
                <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.province) || undefined}>
                  <Label>
                    Province <RequiredMark />
                  </Label>
                  <PsgcSelect
                    options={provinceOptions}
                    value={formValues.province}
                    disabled={saving || psgcLoading.provinces || provinceOptions.length === 0}
                    loading={psgcLoading.provinces}
                    placeholder="Select province"
                    searchPlaceholder="Search province..."
                    emptyText="No provinces found."
                    onSelect={onSelectProvince}
                  />
                  <FieldError message={formErrors.province} />
                </div>
                <div className="grid min-w-0 gap-1.5" data-invalid={Boolean(formErrors.city) || undefined}>
                  <Label>
                    City / Municipality <RequiredMark />
                  </Label>
                  <PsgcSelect
                    options={cityOptions}
                    value={formValues.city}
                    disabled={saving || psgcLoading.cities || cityOptions.length === 0}
                    loading={psgcLoading.cities}
                    placeholder="Select city or municipality"
                    searchPlaceholder="Search city or municipality..."
                    emptyText="No cities or municipalities found."
                    onSelect={onSelectCity}
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
                    onOpen={onLoadBarangays}
                    onSelect={onSelectBarangay}
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
                  onChange={onValueChange}
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
                  onChange={onValueChange}
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
                  onChange={onValueChange}
                />
              </div>
            </section>
          </div>

          <DialogFooter className="shrink-0 border-t p-6 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
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
  );
}
