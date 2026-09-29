"use client";

import React, { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
} from "../types";
import { uploadReceiptFile } from "../services/uploadService";
import { Plus, Trash2, Loader2, Save, Send, Search, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BulkExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  onSubmitBulk: (items: ExpenseFormValues[], asSubmit: boolean) => Promise<void>;
}

interface BulkRowItem {
  id: string;
  expense_date: string;
  payee: number | null;
  is_employee: boolean;
  division_id?: number | null;
  department_id?: number | null;
  coa_id: number | null;
  amount: string;
  remarks: string;
  selectedFile?: File | null;
  receipt_url?: string;
}

export const BulkExpenseModal: React.FC<BulkExpenseModalProps> = ({
  open,
  onOpenChange,
  suppliers,
  coas,
  divisions,
  departments,
  onSubmitBulk,
}) => {
  const createEmptyRow = (): BulkRowItem => ({
    id: Math.random().toString(36).substring(2, 9),
    expense_date: new Date().toISOString().split("T")[0],
    payee: null,
    is_employee: false,
    division_id: null,
    department_id: null,
    coa_id: null,
    amount: "",
    remarks: "",
    selectedFile: null,
    receipt_url: "",
  });

  const [rows, setRows] = useState<BulkRowItem[]>([]);
  const [activeRowId, setActiveRowId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search filter states for active item form dropdowns
  const [payeeSearch, setPayeeSearch] = useState("");
  const [coaSearch, setCoaSearch] = useState("");
  const [divisionSearch, setDivisionSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  // Reset bulk rows & select initial item when modal opens/closes
  useEffect(() => {
    if (!open) {
      setRows([]);
      setActiveRowId("");
      setPayeeSearch("");
      setCoaSearch("");
      setDivisionSearch("");
      setDepartmentSearch("");
    } else {
      const initialRows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
      setRows(initialRows);
      setActiveRowId(initialRows[0].id);
      setPayeeSearch("");
      setCoaSearch("");
      setDivisionSearch("");
      setDepartmentSearch("");
    }
  }, [open]);

  const activeRow = rows.find((r) => r.id === activeRowId) || rows[0];

  const addRow = () => {
    const newRow = createEmptyRow();
    setRows((prev) => [...prev, newRow]);
    setActiveRowId(newRow.id);
  };

  const removeRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (rows.length <= 1) {
      toast.error("At least one receipt row is required");
      return;
    }
    const newRows = rows.filter((r) => r.id !== id);
    setRows(newRows);
    if (activeRowId === id) {
      setActiveRowId(newRows[0].id);
    }
  };

  const updateActiveRow = (field: keyof BulkRowItem, value: unknown) => {
    if (!activeRowId) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== activeRowId) return r;
        
        // If division is changed, reset department if it no longer belongs to the new division
        if (field === "division_id") {
          const newDivisionId = value as number | null;
          let currentDeptId = r.department_id;
          if (currentDeptId && newDivisionId) {
            const deptObj = departments.find((d) => d.department_id === currentDeptId);
            if (deptObj && deptObj.division_id && deptObj.division_id !== newDivisionId) {
              currentDeptId = null;
            }
          }
          return { ...r, division_id: newDivisionId, department_id: currentDeptId };
        }

        return { ...r, [field]: value };
      })
    );
  };

  const MAX_FILE_SIZE_MB = 5;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only image files (JPG, PNG, WEBP, GIF) are allowed");
      e.target.value = "";
      updateActiveRow("selectedFile", null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_MB}MB`);
      e.target.value = "";
      updateActiveRow("selectedFile", null);
      return;
    }

    updateActiveRow("selectedFile", file);
  };

  const isRowComplete = (r: BulkRowItem) => {
    const parsedAmount = parseFloat(r.amount);
    return (
      !!r.expense_date &&
      !!r.payee &&
      !!r.division_id &&
      !!r.department_id &&
      !!r.coa_id &&
      !isNaN(parsedAmount) &&
      parsedAmount > 0 &&
      (!!r.selectedFile || !!r.receipt_url)
    );
  };

  const handleSaveBulk = async (asSubmit: boolean) => {
    // Determine active rows (any row with user-entered values)
    const activeRows = rows.filter(
      (r) =>
        r.payee !== null ||
        r.division_id !== null ||
        r.department_id !== null ||
        r.coa_id !== null ||
        (r.amount && r.amount.trim() !== "") ||
        (r.remarks && r.remarks.trim() !== "") ||
        r.selectedFile ||
        r.receipt_url
    );

    if (activeRows.length === 0) {
      toast.error("Please fill in at least one expense receipt entry");
      return;
    }

    // Validation pass across rows
    for (let idx = 0; idx < activeRows.length; idx++) {
      const r = activeRows[idx];
      const rowNum = idx + 1;

      if (!r.expense_date) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Expense date is required`);
        return;
      }
      if (!r.payee) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Payee / Supplier is required`);
        return;
      }
      if (!r.division_id) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Division is required`);
        return;
      }
      if (!r.department_id) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Department is required`);
        return;
      }
      if (!r.coa_id) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Chart of Account is required`);
        return;
      }
      const parsedAmount = parseFloat(r.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Valid positive amount is required`);
        return;
      }
      if (!r.selectedFile && !r.receipt_url) {
        setActiveRowId(r.id);
        toast.error(`Receipt #${rowNum}: Receipt attachment image is required`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Pre-upload all selected files
      const uploadedUrls: Record<string, string> = {};

      for (let idx = 0; idx < activeRows.length; idx++) {
        const r = activeRows[idx];
        if (r.selectedFile) {
          try {
            const url = await uploadReceiptFile(r.selectedFile);
            uploadedUrls[r.id] = url;
          } catch (err) {
            setActiveRowId(r.id);
            toast.error(
              `Receipt #${idx + 1}: Failed to upload receipt image (${
                err instanceof Error ? err.message : "Network/Server error"
              })`
            );
            setIsSubmitting(false);
            return;
          }
        }
      }

      const validItems: ExpenseFormValues[] = activeRows.map((r) => ({
        expense_date: r.expense_date,
        payee: r.payee!,
        is_employee: r.is_employee,
        division_id: r.division_id,
        department_id: r.department_id,
        coa_id: r.coa_id!,
        amount: parseFloat(r.amount),
        remarks: r.remarks,
        receipt_url: uploadedUrls[r.id] || r.receipt_url || "",
      }));

      await onSubmitBulk(validItems, asSubmit);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dropdown filter options for active receipt
  const filteredSuppliers = suppliers.filter((s) =>
    (s.supplier_name || "").toLowerCase().includes(payeeSearch.toLowerCase())
  );

  const filteredCoas = coas.filter(
    (c) =>
      (c.gl_code || "").toLowerCase().includes(coaSearch.toLowerCase()) ||
      (c.account_title || "").toLowerCase().includes(coaSearch.toLowerCase())
  );

  const filteredDivisions = divisions.filter((d) =>
    (d.division_name || "").toLowerCase().includes(divisionSearch.toLowerCase())
  );

  const availableDepartments = activeRow?.department_id
    ? departments
    : activeRow?.division_id
    ? departments.filter((d) => !d.division_id || d.division_id === activeRow.division_id)
    : departments;

  const filteredDepartments = availableDepartments.filter((d) =>
    (d.department_name || "").toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const getSupplierName = (payeeId: number | null) => {
    if (!payeeId) return "Unassigned Payee";
    const found = suppliers.find((s) => s.id === payeeId);
    return found ? found.supplier_name : `Supplier #${payeeId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="shrink-0 p-5 pb-4 border-b border-border/50 bg-background">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Bulk Receipt Entry (Master-Detail Split Pane)
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Manage multiple expense receipts simultaneously. Select a receipt on the left to edit its complete details on the right.
          </p>
        </DialogHeader>

        {/* Master-Detail Split Pane Main Body */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-muted/20">
          {/* LEFT SIDEBAR: Master Receipt List */}
          <div className="w-72 sm:w-80 border-r border-border/60 bg-background flex flex-col shrink-0">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Receipts ({rows.length})
              </span>
              <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {rows.map((r, idx) => {
                const isActive = r.id === activeRowId;
                const complete = isRowComplete(r);
                const payeeName = getSupplierName(r.payee);
                const amountVal = parseFloat(r.amount);
                const formattedAmount = !isNaN(amountVal) && amountVal > 0 ? `₱${amountVal.toFixed(2)}` : "₱0.00";

                return (
                  <div
                    key={r.id}
                    onClick={() => setActiveRowId(r.id)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isActive
                        ? "bg-primary/10 border-primary/50 shadow-xs ring-1 ring-primary/30"
                        : "bg-card border-border/60 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {complete ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-semibold text-xs truncate">Receipt #{idx + 1}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-mono text-xs font-bold text-primary">
                          {formattedAmount}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove receipt"
                          onClick={(e) => removeRow(r.id, e)}
                          className="h-6 w-6 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate pr-2">{payeeName}</p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-2 font-mono border-t border-border/40 pt-1.5">
                      <span>{r.expense_date || "No date"}</span>
                      {r.selectedFile ? (
                        <span className="text-blue-500 font-medium">Image Ready</span>
                      ) : r.receipt_url ? (
                        <span className="text-emerald-500">Attached</span>
                      ) : (
                        <span className="text-rose-500">No Image</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT CANVAS: Detailed Form for Selected Receipt */}
          {activeRow ? (
            <div className="flex-1 overflow-y-auto p-6 bg-card space-y-5">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-semibold text-sm">
                  Editing Receipt Entry #{rows.findIndex((r) => r.id === activeRow.id) + 1}
                </h3>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => removeRow(activeRow.id, e)}
                  className="h-8 text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Receipt
                </Button>
              </div>

              {/* Expense Date & Payee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Expense Date <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="w-full"
                    value={activeRow.expense_date}
                    onChange={(e) => updateActiveRow("expense_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Payee / Supplier <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={activeRow.payee ? String(activeRow.payee) : ""}
                    onValueChange={(v) => updateActiveRow("payee", parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-full">
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

              {/* Is Employee Flag */}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id={`is_emp_${activeRow.id}`}
                  checked={activeRow.is_employee}
                  onCheckedChange={(checked) => updateActiveRow("is_employee", !!checked)}
                />
                <label
                  htmlFor={`is_emp_${activeRow.id}`}
                  className="text-xs font-medium text-muted-foreground cursor-pointer"
                >
                  Is this payee an Employee? (Mark if applicable)
                </label>
              </div>

              {/* Division & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Division <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={activeRow.division_id ? String(activeRow.division_id) : ""}
                    onValueChange={(v) => updateActiveRow("division_id", v ? parseInt(v, 10) : null)}
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
                    value={activeRow.department_id ? String(activeRow.department_id) : ""}
                    onValueChange={(v) => updateActiveRow("department_id", v ? parseInt(v, 10) : null)}
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
                    value={activeRow.coa_id ? String(activeRow.coa_id) : ""}
                    onValueChange={(v) => updateActiveRow("coa_id", parseInt(v, 10))}
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
                    value={activeRow.amount}
                    onChange={(e) => updateActiveRow("amount", e.target.value)}
                  />
                </div>
              </div>

              {/* Receipt File Attachment Upload */}
              <div className="space-y-2">
                <Label>
                  Receipt Attachment / Image <span className="text-rose-500 font-bold">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Helper note */}
                <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2.5 text-[11px] text-blue-600 dark:text-blue-400 space-y-0.5">
                  <p className="font-semibold flex items-center gap-1">📌 Note for Receipt #{rows.findIndex((r) => r.id === activeRow.id) + 1}:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-blue-300">
                    <li>Strictly <strong>Image files only</strong> (JPG, PNG, WEBP, GIF). Max: 5 MB.</li>
                    <li>File will upload automatically once you save or submit all entries.</li>
                  </ul>
                </div>

                {activeRow.selectedFile ? (
                  <p className="text-xs text-blue-500 font-medium">
                    Selected file: {activeRow.selectedFile.name} (Ready to upload on save)
                  </p>
                ) : activeRow.receipt_url ? (
                  <p className="text-xs text-emerald-500 font-mono truncate">
                    Attached: {activeRow.receipt_url}
                  </p>
                ) : null}
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks / Description</Label>
                <Textarea
                  placeholder="Add expense notes or details..."
                  value={activeRow.remarks}
                  onChange={(e) => updateActiveRow("remarks", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-xs">
              No receipt selected.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="shrink-0 p-4 border-t border-border/50 bg-background gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => handleSaveBulk(false)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save All as Draft
          </Button>
          <Button onClick={() => handleSaveBulk(true)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Save & Submit All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
