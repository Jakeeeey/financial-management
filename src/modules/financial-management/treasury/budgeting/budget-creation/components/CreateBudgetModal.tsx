// src/modules/financial-management/treasury/budgeting/create-budget/components/CreateBudgetModal.tsx

"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Loader2,
  Plus,
  Pencil,
  Paperclip,
  Trash2,
  FileText,
  ImageIcon,
  ChevronDown,
} from "lucide-react";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { useCreateBudgetForm } from "../hooks/useCreateBudgetForm";
import {
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  formatFileSize,
} from "../utils";

// ─── Simple native select wrapper ─────────────────────────────────────────────
function FieldSelect({
  id,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  error,
  loading,
}: {
  id:          string;
  value:       string;
  onChange:    (val: string) => void;
  placeholder: string;
  options:     { value: string; label: string; disabled?: boolean }[];
  disabled?:   boolean;
  error?:      string;
  loading?:    boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || loading}
        className={`flex h-9 w-full appearance-none rounded-md border ${
          error ? "border-destructive" : "border-input"
        } bg-background px-3 py-2 pr-8 text-xs text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <option value="" disabled>{loading ? "Loading..." : placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ─── File icon helper ──────────────────────────────────────────────────────────
function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
export function CreateBudgetModal() {
  const { closeModal, addBudget, updateBudget, editingBudget, supplementParent, isDuplicate } = useCreateBudgetContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    form, errors, loading, 
    divisions, departments, coas, fetchingLookups,
    setField, addFiles, removeFile, handleSubmit 
  } = useCreateBudgetForm(
    payload => {
        // Find names for local display in mock list
        const divName = divisions.find(d => String(d.division_id || (d as any).id) === form.division_id)?.division_name;
        const deptName = departments.find(d => String((d as any).dept_div_id || d.department_id || (d as any).id) === form.department_id)?.department_name;
        const coaName = coas.find(c => String((c as any).dept_div_coa_id || c.coa_id || (c as any).id) === form.coa_id)?.coa_name;

        const names = {
            division_name: divName,
            department_name: deptName,
            coa_name: coaName,
        };

        if (editingBudget) {
            updateBudget(editingBudget.id, payload, names);
        } else {
            addBudget(payload, names);
        }
        closeModal();
    },
    editingBudget,
    supplementParent,
    (y, m, c) => {
        // If it's a supplement, we don't check for duplicates in the same way, or we allow it
        if (supplementParent) return false; 
        return isDuplicate(y, m, c, editingBudget?.id);
    }
  );

  const isEdit = !!editingBudget;
  const isSupplement = !!supplementParent;

  const divisionOptions = (divisions || [])
    .filter(d => d && (d.division_id || (d as any).id))
    .map((d, i) => ({ 
      value: String(d.division_id || (d as any).id), 
      label: d.division_name || (d as any).name || (d as any).divisionName || `Division ${i+1}` 
    }));

  const deptOptions = (departments || [])
    .filter(d => d && (d.department_id || (d as any).id))
    .map((d, i) => ({ 
      value: String((d as any).dept_div_id || d.department_id || (d as any).id), 
      label: d.department_name || (d as any).name || (d as any).departmentName || `Department ${i+1}` 
    }));

  const coaOptions = (coas || [])
    .filter(c => c && (c.coa_id || (c as any).id))
    .map((c, i) => {
        const coaId = (c as any).dept_div_coa_id || c.coa_id || (c as any).id;
        const exists = isDuplicate(Number(form.year), Number(form.month), Number(coaId), editingBudget?.id);
        
        return { 
            value: String(coaId), 
            label: `${c.coa_name || (c as any).name || (c as any).coaName || `Account ${i+1}`} (${c.coa_code || (c as any).code || (c as any).coaCode || "—"})${exists ? " ✓" : ""}`,
            disabled: exists
        };
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl bg-background rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-black tracking-tight uppercase">
                {isSupplement ? "Request Supplemental Budget" : isEdit ? "Edit Budget Entry" : "Create Budget Entry"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSupplement ? "Add additional funding to an approved budget." : isEdit ? "Update the details of this budget entry." : "Fill in the details to create a new budget entry."}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mt-1 -mr-2 shrink-0 active:scale-95 transition-transform"
              onClick={closeModal}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Row: Year + Month */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-year" className="text-xs font-medium">
                    Year <span className="text-destructive">*</span>
                  </Label>
                  <FieldSelect
                    id="budget-year"
                    value={form.year}
                    onChange={v => setField("year", v)}
                    placeholder="Select year"
                    options={YEAR_OPTIONS}
                    disabled={isSupplement}
                    error={errors.year}
                  />
                  {errors.year && (
                    <p className="text-[11px] text-destructive">{errors.year}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="budget-month" className="text-xs font-medium">
                    Month <span className="text-destructive">*</span>
                  </Label>
                  <FieldSelect
                    id="budget-month"
                    value={form.month}
                    onChange={v => setField("month", v)}
                    placeholder="Select month"
                    options={MONTH_OPTIONS}
                    disabled={isSupplement}
                    error={errors.month}
                  />
                  {errors.month && (
                    <p className="text-[11px] text-destructive">{errors.month}</p>
                  )}
                </div>
              </div>

              {/* Row: Division + Department */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-division" className="text-xs font-medium">
                    Division <span className="text-destructive">*</span>
                  </Label>
                  <FieldSelect
                    id="budget-division"
                    value={form.division_id}
                    onChange={v => setField("division_id", v)}
                    placeholder="Select division"
                    options={divisionOptions}
                    disabled={isSupplement}
                    error={errors.division_id}
                    loading={fetchingLookups && divisions.length === 0 && !isSupplement}
                  />
                  {errors.division_id && (
                    <p className="text-[11px] text-destructive">{errors.division_id}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="budget-department" className="text-xs font-medium">
                    Department <span className="text-destructive">*</span>
                  </Label>
                  <FieldSelect
                    id="budget-department"
                    value={form.department_id}
                    onChange={v => setField("department_id", v)}
                    placeholder={form.division_id ? "Select department" : "Select division first"}
                    options={deptOptions}
                    disabled={!form.division_id || isSupplement}
                    error={errors.department_id}
                    loading={fetchingLookups && form.division_id !== "" && !isSupplement}
                  />
                  {errors.department_id && (
                    <p className="text-[11px] text-destructive">{errors.department_id}</p>
                  )}
                </div>
              </div>

              {/* Row: COA + GL Code */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="budget-coa" className="text-xs font-medium">
                    Chart of Account (COA) <span className="text-destructive">*</span>
                  </Label>
                  <FieldSelect
                    id="budget-coa"
                    value={form.coa_id}
                    onChange={v => setField("coa_id", v)}
                    placeholder={form.department_id ? "Select COA" : "Select department first"}
                    options={coaOptions}
                    disabled={!form.department_id || isSupplement}
                    error={errors.coa_id}
                    loading={fetchingLookups && form.department_id !== "" && !isSupplement}
                  />
                  {errors.coa_id && (
                    <p className="text-[11px] text-destructive font-medium bg-destructive/5 p-1.5 rounded border border-destructive/20 mt-1 animate-pulse">
                        {errors.coa_id}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="budget-gl-code" className="text-xs font-medium">
                    GL Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="budget-gl-code"
                    value={form.gl_code}
                    readOnly
                    placeholder="Auto-filled from COA"
                    className={`h-9 text-xs bg-muted/50 font-mono ${errors.gl_code ? "border-destructive" : ""}`}
                  />
                  {errors.gl_code && (
                    <p className="text-[11px] text-destructive">{errors.gl_code}</p>
                  )}
                </div>
              </div>

              {/* Row: Proposed Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="budget-amount" className="text-xs font-medium">
                  {isSupplement ? "Additional Amount" : "Proposed Amount"} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">₱</span>
                    <Input
                        id="budget-amount"
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={e => setField("amount", e.target.value)}
                        placeholder="0.00"
                        className={`h-9 text-xs pl-7 font-bold ${errors.amount ? "border-destructive" : ""}`}
                    />
                </div>
                {errors.amount && (
                  <p className="text-[11px] text-destructive">{errors.amount}</p>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="budget-remarks" className="text-xs font-medium">
                  Remarks
                </Label>
                <textarea
                  id="budget-remarks"
                  value={form.remarks}
                  onChange={e => setField("remarks", e.target.value)}
                  rows={3}
                  placeholder="Optional notes or description…"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Attachments</Label>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99] transition-transform"
                >
                  <Paperclip className="h-5 w-5" />
                  <span className="text-xs">
                    Click to attach files or images
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">
                    PDF, DOCX, PNG, JPG, XLSX and more
                  </span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={e => addFiles(e.target.files)}
                />

                {/* File list */}
                {form.attachments.length > 0 && (
                  <div className="space-y-1.5 rounded-xl border border-border p-3">
                    {form.attachments.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <FileIcon type={file.type} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2 rounded-b-2xl shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeModal}
                className="h-9 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="h-9 px-4 text-xs gap-1.5 active:scale-95 transition-transform"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <>
                    {isSupplement ? <Plus className="h-3.5 w-3.5" /> : isEdit ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {isSupplement ? "Submit Supplement" : isEdit ? "Update Budget" : "Create Budget"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
