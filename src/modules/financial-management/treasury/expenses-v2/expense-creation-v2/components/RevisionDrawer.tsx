"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ExpenseItem,
  ExpenseLog,
  SupplierOption,
  ChartOfAccountOption,
  DivisionOption,
  DepartmentOption,
  ExpenseFormValues,
  UserDefaultsOption,
} from "../types";
import { fetchExpenseLogs } from "../services/expenseService";
import { uploadReceiptFile } from "../services/uploadService";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Image as ImageIcon,
  Clock,
  Edit3,
  Info,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface RevisionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ExpenseItem | null;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  userDefaults?: UserDefaultsOption | null;
  onResubmit: (id: number, values: ExpenseFormValues, notes: string) => Promise<void>;
}

function formatLiteralDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  }

  const [, yearStr, monthStr, dayStr, hourStr, minStr, secStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseInt(secStr, 10);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const monthName = months[month] || "";

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(minute).padStart(2, "0");
  const displaySec = String(second).padStart(2, "0");

  return `${monthName} ${day}, ${year}, ${displayHour}:${displayMin}:${displaySec} ${period}`;
}

export const RevisionDrawer: React.FC<RevisionDrawerProps> = ({
  open,
  onOpenChange,
  item,
  suppliers,
  coas,
  divisions,
  departments,
  userDefaults,
  onResubmit,
}) => {
  const [expenseDate, setExpenseDate] = useState("");
  const [payee, setPayee] = useState<number | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [coaId, setCoaId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [resubmitNotes, setResubmitNotes] = useState("");

  const [payeeSearch, setPayeeSearch] = useState("");
  const [coaSearch, setCoaSearch] = useState("");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [logs, setLogs] = useState<ExpenseLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item && open) {
      setExpenseDate(item.expense_date || "");
      setPayee(item.payee || null);
      setIsEmployee(!!item.is_employee);
      setDivisionId(item.division_id || null);
      const salesDept = departments.find((d) => (d.department_name || "").trim().toLowerCase() === "sales");
      setDepartmentId(item.department_id || (salesDept ? salesDept.department_id : null));
      setCoaId(item.coa_id || null);
      setAmount(String(item.amount || ""));
      setRemarks(item.remarks || "");
      setReceiptUrl(item.receipt_url || "");
      setResubmitNotes("");
      setSelectedFile(null);
      setPayeeSearch("");
      setCoaSearch("");
      setDivisionSearch("");
      setDepartmentSearch("");

      setLoadingLogs(true);
      fetchExpenseLogs(item.id)
        .then((data) => setLogs(data))
        .catch(() => setLogs([]))
        .finally(() => setLoadingLogs(false));
    } else if (!open) {
      setSelectedFile(null);
      setResubmitNotes("");
      setPayeeSearch("");
      setCoaSearch("");
      setDivisionSearch("");
      setDepartmentSearch("");
    }
  }, [item, open, departments]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [divisionSearch, setDivisionSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  const latestConcernLog = logs.find((l) => l.action === "With Concern");

  const renderApproverName = (createdBy: ExpenseLog["created_by"]) => {
    if (!createdBy) return null;
    if (typeof createdBy === "object") {
      const fname = createdBy.user_fname || "";
      const lname = createdBy.user_lname || "";
      const fullName = `${fname} ${lname}`.trim();
      if (fullName) return fullName;
      return `User #${createdBy.user_id}`;
    }
    return `User #${createdBy}`;
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

  const handleDivisionChange = (newDivId: number | null) => {
    setDivisionId(newDivId);
  };

  const availableDepartments = useMemo(() => {
    return departments.filter((d) => (d.department_name || "").trim().toLowerCase() === "sales");
  }, [departments]);

  const filteredDepartments = availableDepartments.filter((d) =>
    (d.department_name || "").toLowerCase().includes((departmentSearch || "").toLowerCase())
  );

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
  };

  const handleConfirmResubmit = async () => {
    if (!item) return;

    if (!expenseDate || !payee || !divisionId || !departmentId || !coaId || !amount) {
      toast.error("Please fill in all required fields (Date, Payee, Division, Department, COA, Amount)");
      return;
    }

    if (!selectedFile && !receiptUrl) {
      toast.error("Receipt attachment image is required");
      return;
    }

    if (!resubmitNotes.trim()) {
      toast.error("Please enter a resubmission explanation/note for the approver");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Valid positive amount is required");
      return;
    }

    try {
      setIsSubmitting(true);
      let finalReceiptUrl = receiptUrl;

      // Upload file ONLY when resubmitting
      if (selectedFile) {
        setIsUploading(true);
        try {
          finalReceiptUrl = await uploadReceiptFile(selectedFile);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to upload file");
          setIsUploading(false);
          setIsSubmitting(false);
          return;
        }
        setIsUploading(false);
      }

      await onResubmit(
        item.id,
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
        resubmitNotes
      );
      setSelectedFile(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resubmission failed");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full bg-card border-border overflow-hidden">
        {/* Header */}
        <SheetHeader className="p-4 sm:p-5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Needs Revision
                  {item?.doc_no && (
                    <Badge variant="outline" className="font-mono text-[10px] bg-background">
                      {item.doc_no}
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update expense details and provide resubmission notes for the approver.
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {item ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
            {/* Approver Concern Card */}
            <div className="bg-amber-500/10 dark:bg-amber-950/40 border-l-4 border-l-amber-500 border-amber-500/30 rounded-xl p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 text-[10px] font-mono font-bold flex items-center gap-1.5 py-0.5 px-2"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  FEEDBACK / CONCERN
                </Badge>

                {!loadingLogs && latestConcernLog?.created_at && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Logged on {formatLiteralDateTime(latestConcernLog.created_at)}
                  </span>
                )}
              </div>

              {loadingLogs ? (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Loading approver logs...</span>
                </div>
              ) : latestConcernLog ? (
                <div className="space-y-2">
                  <blockquote className="text-xs font-semibold text-foreground italic bg-background/80 dark:bg-zinc-900/90 p-3 rounded-lg border border-amber-500/30 shadow-xs">
                    &quot;{latestConcernLog.remarks || "Needs correction"}&quot;
                  </blockquote>
                  {latestConcernLog.created_by && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium pl-0.5">
                      <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Concerned By:</span>
                      <span className="font-bold text-foreground">
                        {renderApproverName(latestConcernLog.created_by)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No explicit concern note logged.</p>
              )}
            </div>

            {/* Editable Fields Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <Edit3 className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Edit Expense Receipt Details
                </h4>
              </div>

              {/* Date & Payee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Expense Date <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="w-full text-xs"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Payee / Supplier <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={payee ? String(payee) : ""}
                    onValueChange={(v) => setPayee(parseInt(v, 10))}
                    disabled
                  >
                    <SelectTrigger className="w-full text-xs">
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
                        {filteredSuppliers.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={String(s.id)}
                            className="text-xs whitespace-normal break-words leading-snug py-2"
                          >
                            {s.supplier_name}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Division & Dept */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Division <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={divisionId ? String(divisionId) : ""}
                    onValueChange={(v) => handleDivisionChange(v ? parseInt(v, 10) : null)}
                  >
                    <SelectTrigger className="w-full text-xs">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Department <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={departmentId ? String(departmentId) : ""}
                    onValueChange={(v) => setDepartmentId(v ? parseInt(v, 10) : null)}
                  >
                    <SelectTrigger className="w-full text-xs">
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

              {/* COA & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    COA Account <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Select
                    value={coaId ? String(coaId) : ""}
                    onValueChange={(v) => setCoaId(parseInt(v, 10))}
                    disabled
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select COA" />
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
                        {filteredCoas.map((c) => (
                          <SelectItem
                            key={c.coa_id}
                            value={String(c.coa_id)}
                            className="text-xs whitespace-normal break-words leading-snug py-2"
                          >
                            {c.gl_code ? `${c.gl_code} - ` : ""}{c.account_title || `COA #${c.coa_id}`}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Amount (₱) <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">
                      ₱
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-full font-bold font-mono text-xs pl-7 text-emerald-500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* View Attachment Button */}
              {receiptUrl ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="w-full h-10 text-xs font-bold gap-2 border-primary/40 hover:bg-primary/5 hover:border-primary text-foreground shadow-xs"
                  >
                    <Eye className="w-4 h-4 text-primary" /> View Receipt Attachment
                  </Button>
                </div>
              ) : null}

              {/* Re-upload File Attachment */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs font-bold text-foreground">
                  Replace Receipt Image (Optional)
                </Label>

                {selectedFile ? (
                  /* Selected New File Preview Card */
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
                          • <span className="text-blue-500 font-medium">Will upload on resubmit</span>
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange}
                      disabled={isUploading || isSubmitting}
                      className="text-xs bg-background"
                    />
                    {isUploading || isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : null}
                  </div>
                )}
                
                {/* Encoder Helper Note Box */}
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-[11px] text-blue-600 dark:text-blue-400 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" /> Attachment Requirements:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-blue-300 text-[10.5px]">
                    <li>Strictly <strong>Image files only</strong> (JPG, PNG, WEBP, GIF).</li>
                    <li>Maximum file size limit: <strong>5 MB</strong>.</li>
                  </ul>
                </div>
              </div>

              {/* Resubmission Explanation Note */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label className="text-xs font-bold text-primary">
                  Resubmission Explanation / Note for Approver <span className="text-rose-500 font-bold">*</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Briefly explain what changes or corrections were made to address the concern.
                </p>
                <Textarea
                  placeholder="Explain what changes/corrections you made (e.g. Uploaded clear receipt image, corrected COA)..."
                  value={resubmitNotes}
                  onChange={(e) => setResubmitNotes(e.target.value)}
                  rows={3}
                  className="border-primary/40 focus:border-primary text-xs bg-background"
                />
              </div>
            </div>
          </div>
        ) : null}

        <SheetFooter className="sticky bottom-0 bg-card border-t border-border p-4 gap-2 shadow-lg z-20 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 shadow-xs"
            onClick={handleConfirmResubmit}
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Resubmit for Approval
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Isolated High-Performance Pan & Zoom Modal Component */}
      <ReceiptZoomModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptUrl={receiptUrl}
        docNo={item?.doc_no}
      />
    </Sheet>
  );
};

// Standalone Isolated Modal Component to avoid parent re-renders during mouse dragging
interface ReceiptZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl?: string;
  docNo?: string;
}

const ReceiptZoomModal: React.FC<ReceiptZoomModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  docNo,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const rAFRef = React.useRef<number | null>(null);

  const updateDOMTransform = (scale: number, x: number, y: number) => {
    if (imgRef.current) {
      imgRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${scale})`;
    }
  };

  const resetPanZoom = useCallback(() => {
    setZoomScale(1);
    posRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    updateDOMTransform(1, 0, 0);
  }, []);


  const handleZoomIn = () => {
    setZoomScale((prev) => {
      const next = Math.min(Number((prev + 0.25).toFixed(2)), 4);
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 0.5);
      if (next <= 1) {
        posRef.current = { x: 0, y: 0 };
      }
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else if (e.deltaY > 0) {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    posRef.current = { x: newX, y: newY };

    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }
    rAFRef.current = requestAnimationFrame(() => {
      updateDOMTransform(zoomScale, newX, newY);
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetPanZoom();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] max-h-[92vh] p-0 overflow-hidden bg-card border-border flex flex-col">
        {/* Compact Header with Pan & Zoom Controls */}
        <DialogHeader className="p-2.5 px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
              <DialogTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Receipt Attachment Preview</span>
                {docNo && (
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 bg-background">
                    {docNo}
                  </Badge>
                )}
              </DialogTitle>
            </div>

            {/* Interactive Zoom Toolbar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-background/90 dark:bg-zinc-900 border border-border p-0.5 rounded-lg shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 0.5}
                  className="h-6 w-6 rounded-md"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>

                <span className="font-mono text-[11px] font-bold text-foreground px-1.5 min-w-[44px] text-center select-none">
                  {Math.round(zoomScale * 100)}%
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  className="h-6 w-6 rounded-md"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetPanZoom}
                  className="h-6 text-[10px] font-semibold gap-1 px-2 text-muted-foreground hover:text-foreground border-l border-border/80 rounded-none rounded-r-md"
                  title="Reset Zoom & Drag Position"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
              </div>

              {receiptUrl && (
                <a
                  href={getAssetUrl(receiptUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 mr-6"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Draggable & Zoomable Viewport Container */}
        <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`p-3 bg-zinc-950/95 flex items-center justify-center flex-1 min-h-[480px] max-h-[82vh] overflow-hidden select-none relative ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {zoomScale > 1 && (
            <div className="absolute top-2 left-2 z-10 bg-black/60 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 pointer-events-none">
              <Move className="w-3 h-3 text-amber-400" /> Click & Drag to explore all corners
            </div>
          )}

          {receiptUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={imgRef}
              src={getAssetUrl(receiptUrl)}
              alt="Receipt Attachment"
              draggable={false}
              style={{
                willChange: "transform",
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl border border-zinc-800/80 pointer-events-auto origin-center transition-none"
            />
          ) : (
            <p className="text-xs text-zinc-400 italic">No receipt image URL found.</p>
          )}
        </div>

        {/* Compact Footer */}
        <DialogFooter className="p-2 px-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            Use mouse wheel to zoom • Drag image to view all corners
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs font-semibold px-4"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
