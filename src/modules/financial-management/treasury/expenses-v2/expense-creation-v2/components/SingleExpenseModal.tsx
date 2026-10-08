"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExpenseFormValues,
  SupplierOption,
  ChartOfAccountOption,
  DivisionOption,
  DepartmentOption,
  UserDefaultsOption,
} from "../types";
import { uploadReceiptFile } from "../services/uploadService";
import { Loader2, Save, Send, Search, AlertCircle, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface SingleExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  userDefaults?: UserDefaultsOption | null;
  onSubmit: (values: ExpenseFormValues, asSubmit: boolean) => Promise<void>;
}

export const SingleExpenseModal: React.FC<SingleExpenseModalProps> = ({
  open,
  onOpenChange,
  suppliers,
  coas,
  divisions,
  departments,
  userDefaults,
  onSubmit,
}) => {
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [payee, setPayee] = useState<number | null>(null);
  const [isEmployee, setIsEmployee] = useState<boolean>(false);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [coaId, setCoaId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Search states inside dropdowns
  const [payeeSearch, setPayeeSearch] = useState("");
  const [coaSearch, setCoaSearch] = useState("");
  const [divisionSearch, setDivisionSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const resetForm = useCallback(() => {
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setPayee(userDefaults?.supplier_id ?? null);
    setIsEmployee(true);
    setDivisionId(userDefaults?.division_id ?? null);
    const salesDept = departments.find((d) => (d.department_name || "").trim().toLowerCase() === "sales");
    setDepartmentId(salesDept ? salesDept.department_id : null);
    setCoaId(null);
    setAmount("");
    setRemarks("");
    setSelectedFile(null);
    setReceiptUrl("");
    setPayeeSearch("");
    setCoaSearch("");
    setDivisionSearch("");
    setDepartmentSearch("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [userDefaults, departments]);

  // Reset form inputs whenever modal opens, closes, or userDefaults changes
  useEffect(() => {
    resetForm();
  }, [open, resetForm]);

  const handleDivisionChange = (newDivId: number | null) => {
    setDivisionId(newDivId);
  };

  const MAX_FILE_SIZE_MB = 5;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only image files (JPG, PNG, WEBP, GIF) are allowed");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_MB}MB`);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFile(null);
    setReceiptUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async (asSubmit: boolean) => {
    if (isSubmitting || isUploading) return;

    if (!expenseDate) {
      toast.error("Expense date is required");
      return;
    }
    if (!payee) {
      toast.error("Payee / Supplier is required");
      return;
    }
    if (!divisionId) {
      toast.error("Division is required");
      return;
    }
    if (!departmentId) {
      toast.error("Department is required");
      return;
    }
    if (!coaId) {
      toast.error("Chart of account is required");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Valid positive amount is required");
      return;
    }
    if (!selectedFile && !receiptUrl) {
      toast.error("Receipt attachment image is required");
      return;
    }

    try {
      setIsSubmitting(true);
      let finalReceiptUrl = receiptUrl;

      // Upload file to Directus ONLY when saving/submitting
      if (selectedFile) {
        setIsUploading(true);
        try {
          finalReceiptUrl = await uploadReceiptFile(selectedFile);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to upload image");
          setIsUploading(false);
          setIsSubmitting(false);
          return;
        }
        setIsUploading(false);
      }

      await onSubmit(
        {
          expense_date: expenseDate,
          payee,
          is_employee: isEmployee,
          division_id: divisionId,
          department_id: departmentId,
          coa_id: coaId,
          amount: parsedAmount,
          remarks,
          receipt_url: finalReceiptUrl,
        },
        asSubmit
      );
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    (s.supplier_name || "").toLowerCase().includes((payeeSearch || "").toLowerCase())
  );

  const filteredCoas = coas.filter(
    (c) =>
      (c.gl_code || "").toLowerCase().includes((coaSearch || "").toLowerCase()) ||
      (c.account_title || "").toLowerCase().includes((coaSearch || "").toLowerCase())
  );

  const availableDivisions = useMemo(() => {
    if (userDefaults?.is_salesman && userDefaults?.allowed_division_ids && userDefaults.allowed_division_ids.length > 0) {
      return divisions.filter((d) => userDefaults.allowed_division_ids!.includes(d.division_id));
    }
    return divisions;
  }, [divisions, userDefaults]);

  const filteredDivisions = availableDivisions.filter((d) =>
    (d.division_name || "").toLowerCase().includes((divisionSearch || "").toLowerCase())
  );

  const availableDepartments = useMemo(() => {
    return departments.filter((d) => (d.department_name || "").trim().toLowerCase() === "sales");
  }, [departments]);

  const filteredDepartments = availableDepartments.filter((d) =>
    (d.department_name || "").toLowerCase().includes((departmentSearch || "").toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/80 shrink-0 bg-background">
          <DialogTitle>Create New Expense Receipt</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 py-3 space-y-4">
          {/* Missing Supplier Profile Notice Banner */}
          {!payee && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">No Supplier/Payee Profile Found</p>
                <p className="text-[11px] text-muted-foreground dark:text-amber-300/80 leading-relaxed">
                  Your account has not yet been linked to a Supplier/Payee record in the database. Please contact our MIS or HR to set up your supplier profile before encoding your expenses.
                </p>
              </div>
            </div>
          )}

          {/* Expense Date & Payee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Expense Date <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Input
                type="date"
                className="w-full"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Payee / Supplier <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Select
                value={payee ? String(payee) : ""}
                onValueChange={(v) => setPayee(parseInt(v, 10))}
                disabled={true}
              >
                <SelectTrigger className="w-full bg-muted/60 cursor-not-allowed opacity-90">
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="w-[var(--radix-select-trigger-width)] max-h-64 p-0 overflow-hidden z-[100] bg-popover text-popover-foreground border border-border shadow-md"
                >
                  <div className="p-2 sticky top-0 bg-popover z-20 border-b border-border/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search supplier..."
                        value={payeeSearch}
                        onChange={(e) => setPayeeSearch(e.target.value)}
                        className="h-8 text-xs pl-7"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto overflow-x-hidden p-1">
                    {filteredSuppliers.length === 0 ? (
                      <div className="p-3 text-xs text-center text-muted-foreground">
                        No supplier found
                      </div>
                    ) : (
                      filteredSuppliers.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={String(s.id)}
                          className="text-xs whitespace-normal break-words leading-snug py-2"
                        >
                          {s.supplier_name}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Division & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Division <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Select
                value={divisionId ? String(divisionId) : ""}
                onValueChange={(v) => handleDivisionChange(v ? parseInt(v, 10) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="w-[var(--radix-select-trigger-width)] max-h-64 p-0 overflow-hidden z-[100] bg-popover text-popover-foreground border border-border shadow-md"
                >
                  <div className="p-2 sticky top-0 bg-popover z-20 border-b border-border/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search division..."
                        value={divisionSearch}
                        onChange={(e) => setDivisionSearch(e.target.value)}
                        className="h-8 text-xs pl-7"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto overflow-x-hidden p-1">
                    {filteredDivisions.length === 0 ? (
                      <div className="p-3 text-xs text-center text-muted-foreground">
                        No division found
                      </div>
                    ) : (
                      filteredDivisions.map((d) => (
                        <SelectItem
                          key={d.division_id}
                          value={String(d.division_id)}
                          className="text-xs whitespace-normal break-words leading-snug py-2"
                        >
                          {d.division_name}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Department <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Select
                value={departmentId ? String(departmentId) : ""}
                onValueChange={(v) => setDepartmentId(v ? parseInt(v, 10) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="w-[var(--radix-select-trigger-width)] max-h-64 p-0 overflow-hidden z-[100] bg-popover text-popover-foreground border border-border shadow-md"
                >
                  <div className="p-2 sticky top-0 bg-popover z-20 border-b border-border/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search department..."
                        value={departmentSearch}
                        onChange={(e) => setDepartmentSearch(e.target.value)}
                        className="h-8 text-xs pl-7"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto overflow-x-hidden p-1">
                    {filteredDepartments.length === 0 ? (
                      <div className="p-3 text-xs text-center text-muted-foreground">
                        No department found
                      </div>
                    ) : (
                      filteredDepartments.map((d) => (
                        <SelectItem
                          key={d.department_id}
                          value={String(d.department_id)}
                          className="text-xs whitespace-normal break-words leading-snug py-2"
                        >
                          {d.department_name}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart of Accounts & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Chart of Account (COA) <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Select
                value={coaId ? String(coaId) : ""}
                onValueChange={(v) => setCoaId(parseInt(v, 10))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select GL Account" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="w-[var(--radix-select-trigger-width)] max-h-64 p-0 overflow-hidden z-[100] bg-popover text-popover-foreground border border-border shadow-md"
                >
                  <div className="p-2 sticky top-0 bg-popover z-20 border-b border-border/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search COA..."
                        value={coaSearch}
                        onChange={(e) => setCoaSearch(e.target.value)}
                        className="h-8 text-xs pl-7"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto overflow-x-hidden p-1">
                    {filteredCoas.length === 0 ? (
                      <div className="p-3 text-xs text-center text-muted-foreground">
                        No COA account found
                      </div>
                    ) : (
                      filteredCoas.map((c) => (
                        <SelectItem
                          key={c.coa_id}
                          value={String(c.coa_id)}
                          className="text-xs whitespace-normal break-words leading-snug py-2"
                        >
                          {c.gl_code ? `${c.gl_code} - ` : ""}{c.account_title || `COA #${c.coa_id}`}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Amount (₱) <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full font-mono font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Receipt File Attachment Upload */}
          <div className="space-y-2">
            <Label>
              Receipt Attachment / Image <span className="text-rose-500 font-bold">*</span>
            </Label>

            {selectedFile ? (
              /* Selected File Preview Card */
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedFile.size < 1024 * 1024
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}{" "}
                      • <span className="text-blue-500 font-medium">Ready to upload on save</span>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isUploading || isSubmitting}
                  className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              </div>
            ) : receiptUrl ? (
              /* Existing Attached URL Card */
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={receiptUrl}>
                      Attached Image
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      {receiptUrl}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isUploading || isSubmitting}
                  className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              </div>
            ) : (
              /* Clean File Input */
              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={isUploading || isSubmitting}
                />
                {isUploading || isSubmitting ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : null}
              </div>
            )}
            
            {/* Encoder Helper Note Box */}
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2.5 text-[11px] text-blue-600 dark:text-blue-400 space-y-0.5">
              <p className="font-semibold flex items-center gap-1">
                📌 Encoder Note:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-blue-300">
                <li>Strictly <strong>Image files only</strong> (JPG, PNG, WEBP, GIF).</li>
                <li>Maximum file size limit: <strong>5 MB</strong>.</li>
                <li>Image file will only upload to server once saved or submitted.</li>
              </ul>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Remarks / Description</Label>
            <Textarea
              placeholder="Add expense notes or details..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-5 pt-3 border-t border-border/80 shrink-0 bg-background flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSave(false)}
            disabled={isSubmitting || isUploading || (!!userDefaults && !userDefaults.supplier_id)}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={isSubmitting || isUploading || (!!userDefaults && !userDefaults.supplier_id)}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Save & Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
