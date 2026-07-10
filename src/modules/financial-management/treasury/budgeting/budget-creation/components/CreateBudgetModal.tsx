// src/modules/financial-management/treasury/budgeting/budget-creation/components/CreateBudgetModal.tsx

"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Check,
} from "lucide-react";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { useCreateBudgetForm } from "../hooks/useCreateBudgetForm";
import {
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  formatFileSize,
} from "../utils";
import { toast } from "sonner";

// Searchable select wrapper for budget modal fields.
type FieldSelectOption = { value: string; label: string; disabled?: boolean };

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
  options:     FieldSelectOption[];
  disabled?:   boolean;
  error?:      string;
  loading?:    boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label;
  const isDisabled = disabled || loading;

  const handleSelect = (nextValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={!!error}
          disabled={isDisabled}
          className={cn(
            "h-9 w-full justify-between rounded-md border px-3 py-2 text-xs font-normal",
            "bg-background text-foreground shadow-none hover:bg-background",
            !selectedLabel && "text-muted-foreground",
            error && "border-destructive",
            isDisabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="truncate">{loading ? "Loading..." : selectedLabel || placeholder}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-9 text-xs" />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((o, idx) => (
                <CommandItem
                  key={`${o.value}-${idx}`}
                  value={`${o.label} ${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => handleSelect(o.value, o.disabled)}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === o.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── File icon helper ──────────────────────────────────────────────────────────
function FileIcon({ type }: { type?: string }) {
  if (type?.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
export function CreateBudgetModal() {
  const { closeModal, addBudget, updateBudget, editingBudget, supplementParent, isDuplicate } = useCreateBudgetContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const { 
    form, existingAttachments, errors, loading, 
    divisions, departments, coas, usedCoaIds, fetchingLookups,
    setField, addFiles, removeFile, removeExistingAttachment, handleSubmit 
  } = useCreateBudgetForm(
    async (payload, names) => {
        try {
            if (editingBudget) {
                await updateBudget(String(editingBudget.id), payload, names);
            } else {
                await addBudget(payload, names);
            }
            closeModal();
        } catch (error) {
            console.error("Submission failed:", error);
            toast.error(error instanceof Error ? error.message : "Budget submission failed. Please try again.");
        }
    },
    editingBudget,
    supplementParent,
    (y, m, c, divId, deptId) => {
        return isDuplicate(y, m, c, divId, deptId, editingBudget ? String(editingBudget.id) : undefined);
    }
  );

  const isEdit = !!editingBudget;
  const isSupplement = !!supplementParent;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const monthOptions = MONTH_OPTIONS.map(opt => ({
    ...opt,
    disabled: Number(form.year) === currentYear && Number(opt.value) < currentMonth,
  }));

  const divisionOptions = (divisions || [])
    .filter(d => d && d.division_id)
    .map((d, i) => ({ 
      value: String(d.division_id), 
      label: d.division_name || `Division ${i+1}` 
    }));

  const deptOptions = (departments || [])
    .filter(d => d && d.department_id)
    .map((d, i) => ({ 
      value: String(d.department_id), 
      label: d.department_name || `Department ${i+1}` 
    }));

  const coaOptions = (coas || [])
    .filter(c => c && c.coa_id)
    .map((c, i) => {
        const id = String(c.coa_id);
        const isUsed = usedCoaIds.has(Number(id));
        return { 
          value: id, 
          label: isUsed
            ? `${c.account_title || `Account ${i+1}`} (${c.gl_code || "—"}) — Already budgeted`
            : `${c.account_title || `Account ${i+1}`} (${c.gl_code || "—"})`,
          disabled: isUsed,
        };
    });


  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeModal}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl bg-background rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">

          <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-black tracking-tight uppercase">
                {isSupplement ? "Request Supplemental Budget" : isEdit ? "Edit Budget Entry" : "Create Budget Entry"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSupplement ? "Add additional funding to an approved budget." : isEdit ? "Update the details of this budget entry." : "Fill in the details to create a new budget entry."}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <form id="budget-form" onSubmit={handleSubmit} className="space-y-6">
              
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
                    disabled={isEdit || isSupplement}
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
                    options={monthOptions}
                    disabled={isEdit || isSupplement}
                    error={errors.month}
                  />
                  {errors.month && (
                    <p className="text-[11px] text-destructive">{errors.month}</p>
                  )}
                </div>
              </div>

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
                    disabled={isEdit || isSupplement}
                    error={errors.division_id}
                    loading={fetchingLookups && divisions.length === 0 && !isEdit && !isSupplement}
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
                    disabled={isEdit || !form.division_id || isSupplement}
                    error={errors.department_id}
                    loading={fetchingLookups && form.division_id !== "" && !isEdit && !isSupplement}
                  />
                  {errors.department_id && (
                    <p className="text-[11px] text-destructive">{errors.department_id}</p>
                  )}
                </div>
              </div>

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
                    disabled={isEdit || !form.department_id || isSupplement}
                    error={errors.coa_id}
                    loading={fetchingLookups && form.department_id !== "" && !isEdit && !isSupplement}
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

              <div className="space-y-1.5">
                <Label htmlFor="budget-amount" className="text-xs font-medium">
                  {isSupplement ? "Additional Amount" : "Proposed Amount"} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    ₱
                  </span>
                  <Input
                    id="budget-amount"
                    type="text"
                    value={form.amount.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    onChange={e => {
                        const val = e.target.value.replace(/,/g, "");
                        if (/^\d*\.?\d*$/.test(val)) {
                            setField("amount", val);
                        }
                    }}
                    placeholder="0,000.00"
                    className={`h-11 pl-7 text-sm font-bold tracking-tight ${errors.amount ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-[11px] text-destructive">{errors.amount}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget-remarks" className="text-xs font-medium">
                  Remarks
                </Label>
                <textarea
                  id="budget-remarks"
                  value={form.remarks}
                  onChange={e => setField("remarks", e.target.value)}
                  placeholder="Optional notes or justification..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Attachments</Label>
                
                {/* ── Existing Attachments ── */}
                {existingAttachments.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">Existing Files</p>
                    {existingAttachments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-border bg-primary/5 text-[11px] group/item"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileIcon type={a.type || undefined} />
                          <div className="flex flex-col truncate">
                            <a 
                                href={a.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium truncate hover:text-primary transition-colors cursor-pointer"
                            >
                                {a.name}
                            </a>
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(Number(a.size || 0))}</span>
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="p-1 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground/50 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-sm font-black tracking-tight">
                                Remove Attachment?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs">
                                This will permanently delete <span className="font-semibold text-foreground">{a.name}</span> from the server. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="h-8 text-xs rounded-lg">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeExistingAttachment(a.id)}
                                className="h-8 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Upload Box ── */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group ${
                    isDragging 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-full transition-colors ${isDragging ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-primary/10 group-hover:text-primary"}`}>
                    <Paperclip className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold">{isDragging ? "Drop files here" : "Click or drag files to attach"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Excel, PDF, Word, and image files only (Max 25MB)</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={e => {
                      addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                    multiple
                    className="hidden"
                  />
                </div>

                {/* ── New Attachments ── */}
                {form.attachments.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-3">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">New Files to Upload</p>
                    {form.attachments.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg border border-border bg-green-500/5 border-green-500/20 text-[11px]"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileIcon type={file.type || undefined} />
                          <div className="flex flex-col truncate">
                            <span className="font-medium truncate">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(Number(file.size || 0))}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/10 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
            <Button
              variant="outline"
              size="sm"
              onClick={closeModal}
              disabled={loading}
              className="h-9 px-5 rounded-lg text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              form="budget-form"
              type="submit"
              size="sm"
              disabled={loading}
              className="h-9 px-5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isSupplement ? (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Add Supplemental
                    </>
                  ) : isEdit ? (
                    <>
                      <Pencil className="h-3.5 w-3.5" />
                      Update Budget
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Create Budget
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
