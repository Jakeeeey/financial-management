"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Trash2, Loader2, Save, Calculator,
    FileText, Check, ChevronsUpDown, Printer, UploadCloud, RefreshCw,
    DownloadCloud, Search, PlusCircle,
    PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { disbursementProvider } from "../providers/fetchProvider";
import { formatCurrency } from "../utils/disbursement-utils";
import { generateDisbursementPDF } from "../utils/pdfGenerator";
import { StickyTableWrapper } from "../components/StickyTableWrapper";
import {
    DisbursementPayload, PayableLine, SupplierDto, COADto, DivisionDto, DepartmentDto, Disbursement,
    UnpaidPoDto, MemoDto
} from "../types";

const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length < 3) return new Date(dateStr);
    const [year, month, day] = parts.map(Number);
    return new Date(year, month - 1, day);
};

// Simple custom searchable select for inline table dropdowns
interface SearchSelectProps<T extends string | number> {
    options: { label: string; value: T }[];
    value: T | "";
    onSelect: (val: T) => void;
    placeholder: string;
    className?: string;
}

function SearchSelect<T extends string | number>({ options, value, onSelect, placeholder, className }: SearchSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between w-full h-9 text-xs font-bold uppercase bg-background px-2.5", className)}>
                    <span className="truncate text-left">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-55" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 shadow-lg border-border" align="start">
                <Command filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                }}>
                    <CommandInput placeholder="Search..." className="h-9 text-xs" />
                    <CommandList className="max-h-[220px] scrollbar-thin">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground font-bold">No matches found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt, idx) => (
                                <CommandItem
                                    key={`${opt.value}-${idx}`}
                                    value={opt.label}
                                    onSelect={() => {
                                        onSelect(opt.value);
                                        setOpen(false);
                                    }}
                                    className="text-xs cursor-pointer py-2 font-bold uppercase"
                                >
                                    <Check className={cn("mr-2 h-4.5 w-4.5 text-primary", String(value) === String(opt.value) ? "opacity-100" : "opacity-0")} />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

interface PreparationSubmoduleProps {
    onSuccess?: () => void;
    editData?: Disbursement | null;
}

export default function PreparationSubmodule({ onSuccess, editData }: PreparationSubmoduleProps) {
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

    // Collapsible Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Local override for selected editable voucher
    const [localEditVoucher, setLocalEditVoucher] = useState<Disbursement | null>(null);
    const activeVoucher = localEditVoucher || editData || null;

    // List of editable vouchers (Draft / Returned for Revision)
    const [editableVouchers, setEditableVouchers] = useState<Disbursement[]>([]);
    const [loadingVouchers, setLoadingVouchers] = useState(false);

    // Sidebar search and filters
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [sidebarStatusFilter, setSidebarStatusFilter] = useState<"All" | "Draft" | "Returned for Revision">("All");
    const [sidebarTypeFilter, setSidebarTypeFilter] = useState<"All" | "Trade" | "Non-Trade">("All");

    // Form states
    const [transactionTypeId, setTransactionTypeId] = useState<number>(1);
    const [payeeId, setPayeeId] = useState<number | "">("");
    const [remarks, setRemarks] = useState("");
    const [transactionDate, setTransactionDate] = useState(today);
    const [divisionId, setDivisionId] = useState<number | "">("");
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [supportingDocumentsUrl, setSupportingDocumentsUrl] = useState("");
    const [payables, setPayables] = useState<PayableLine[]>([]);

    const isNonTradeVoucher = transactionTypeId === 2;

    // Unpaid PO state
    const [unpaidPos, setUnpaidPos] = useState<UnpaidPoDto[]>([]);
    const [loadingPos, setLoadingPos] = useState(false);
    const [isPoModalOpen, setIsPoModalOpen] = useState(false);
    const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
    const [taxTypes, setTaxTypes] = useState<Record<string, "VAT" | "NON_VAT">>({});
    const [poSearchQuery, setPoSearchQuery] = useState("");

    // Memo state
    const [memos, setMemos] = useState<MemoDto[]>([]);
    const [loadingMemos, setLoadingMemos] = useState(false);
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

    // Dropdowns / Lookups
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    const coaOptions = useMemo(() => coas.map(c => ({ label: `${c.glCode} - ${c.accountTitle}`, value: c.coaId })), [coas]);
    const divisionOptions = useMemo(() => divisions.map(d => ({ label: d.divisionName, value: d.divisionId })), [divisions]);
    const departmentOptions = useMemo(() => departments.map(d => ({ label: d.departmentName, value: d.departmentId })), [departments]);
    
    // Loaders
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Print Success Modal
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [createdDisbursement, setCreatedDisbursement] = useState<Disbursement | null>(null);

    // Validation State
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    // Sidebar Filters
    const [sidebarStartDate, setSidebarStartDate] = useState("");
    const [sidebarEndDate, setSidebarEndDate] = useState("");
    const [sidebarPayeeId, setSidebarPayeeId] = useState<number | "">("");

    // Dropdown triggers
    const [payeeOpen, setPayeeOpen] = useState(false);

    // Load list of editable vouchers
    const fetchEditableVouchers = useCallback(async () => {
        setLoadingVouchers(true);
        try {
            // Fetch Draft & Returned for Revision vouchers (up to 100 records, unposted only)
            const res = await disbursementProvider.getDisbursements(
                0,
                100,
                "All",
                "",
                "",
                "",
                "Draft,Returned for Revision",
                "",
                "",
                "",
                "0"
            );
            setEditableVouchers(res.content || []);
        } catch (err) {
            console.error("Failed to load editable vouchers", err);
        } finally {
            setLoadingVouchers(false);
        }
    }, []);

    // Filter and sort editable vouchers based on sidebar filters and created date
    const filteredEditableVouchers = useMemo(() => {
        return editableVouchers
            .filter((v) => {
                // Ensure the voucher is not posted (extra safety check)
                if (v.isPosted === 1) return false;

                // Search term matches document number, payee name, or remarks
                const matchesSearch =
                    !sidebarSearch ||
                    (v.docNo || "").toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                    (v.payeeName || "").toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                    (v.remarks || "").toLowerCase().includes(sidebarSearch.toLowerCase());

                // Filter by status
                const matchesStatus =
                    sidebarStatusFilter === "All" ||
                    v.status === sidebarStatusFilter;

                // Filter by transaction type
                const matchesType =
                    sidebarTypeFilter === "All" ||
                    (sidebarTypeFilter === "Trade" && v.transactionTypeName === "Trade") ||
                    (sidebarTypeFilter === "Non-Trade" && v.transactionTypeName === "Non-Trade");

                // Filter by date range
                const matchesDateRange =
                    (!sidebarStartDate || (v.transactionDate && v.transactionDate >= sidebarStartDate)) &&
                    (!sidebarEndDate || (v.transactionDate && v.transactionDate <= sidebarEndDate));

                // Filter by payee supplier
                const matchesPayee =
                    sidebarPayeeId === "" ||
                    v.payeeId === sidebarPayeeId;

                return matchesSearch && matchesStatus && matchesType && matchesDateRange && matchesPayee;
            })
            .sort((a, b) => {
                // Sort by created date descending (newest first)
                const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                return dateB - dateA;
            });
    }, [editableVouchers, sidebarSearch, sidebarStatusFilter, sidebarTypeFilter, sidebarStartDate, sidebarEndDate, sidebarPayeeId]);

    // Load active records from DB
    const loadMetadata = useCallback(async () => {
        setLoadingData(true);
        try {
            const [tradeList, nonTradeList, coaList, divList, deptList] = await Promise.all([
                disbursementProvider.getSuppliers("Trade").catch(() => []),
                disbursementProvider.getSuppliers("Non-Trade").catch(() => []),
                disbursementProvider.getCOAs().catch(() => []),
                disbursementProvider.getDivisions().catch(() => []),
                disbursementProvider.getDepartments().catch(() => [])
            ]);

            setSuppliers([...tradeList, ...nonTradeList].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
            setCoas(coaList);
            setDivisions(divList);
            setDepartments(deptList);
        } catch (err) {
            console.error("Failed to load metadata", err);
            toast.error("Failed to load metadata. Please refresh.");
        } finally {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        loadMetadata();
        fetchEditableVouchers();
    }, [loadMetadata, fetchEditableVouchers]);

    // Synchronize form values with active edit voucher
    useEffect(() => {
        if (activeVoucher) {
            setTransactionTypeId(activeVoucher.transactionTypeName === "Non-Trade" ? 2 : 1);
            setPayeeId(activeVoucher.payeeId || "");
            setRemarks(activeVoucher.remarks || "");
            setTransactionDate(activeVoucher.transactionDate || today);
            setDivisionId(activeVoucher.divisionId || "");
            setDepartmentId(activeVoucher.departmentId || "");
            setSupportingDocumentsUrl(activeVoucher.supportingDocumentsUrl || "");
            setPayables(activeVoucher.payables || []);
            setShowValidationErrors(false);
        } else {
            // Reset to blank voucher creation
            setPayeeId("");
            setRemarks("");
            setTransactionDate(today);
            setDivisionId("");
            setDepartmentId("");
            setSupportingDocumentsUrl("");
            setPayables([]);
            setShowValidationErrors(false);
        }
    }, [activeVoucher, today]);

    const handleOpenPoModal = useCallback(async (supplierIdOverride?: number) => {
        const sid = supplierIdOverride ?? (payeeId ? Number(payeeId) : null);
        if (!sid) return toast.error("Please select a Payee first.");
        setLoadingPos(true);
        setIsPoModalOpen(true);
        try {
            const pos = await disbursementProvider.getUnpaidPos(sid);
            setUnpaidPos(pos);
            setSelectedPoIds([]);
            setTaxTypes({});
            setPoSearchQuery("");
        } catch {
            toast.error("Failed to load unpaid POs");
            setIsPoModalOpen(false);
        } finally {
            setLoadingPos(false);
        }
    }, [payeeId]);

    const handlePayeeSelect = useCallback((val: number) => {
        setPayeeId(val);
        if (transactionTypeId === 1 && val) {
            handleOpenPoModal(val);
        }
    }, [transactionTypeId, handleOpenPoModal]);

    const calculateTaxedPayables = useCallback((selectedPos: UnpaidPoDto[], currentTaxTypes: Record<string, "VAT" | "NON_VAT">, date: string): PayableLine[] => {
        const newPayables: PayableLine[] = [];
        const VAT_RATE = 0.12;
        const EWT_RATE = 0.01;

        selectedPos.forEach(po => {
            const baseRef = `${po.poNo} / ${po.receiptNo}`;
            const taxType = currentTaxTypes[po.uniqueKey] || "VAT";
            const lineDivId = divisionId ? Number(divisionId) : undefined;

            if (taxType === "VAT") {
                const netAmount = po.amountDue / (1 + VAT_RATE);
                const vatAmount = netAmount * VAT_RATE;
                const ewtAmount = netAmount * EWT_RATE;
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(netAmount.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal Net of VAT`,
                    divisionId: lineDivId
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(vatAmount.toFixed(2)),
                    coaId: 9,
                    remarks: `Input VAT (12%)`,
                    divisionId: lineDivId
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: -Number(ewtAmount.toFixed(2)),
                    coaId: 38,
                    remarks: `EWT Deduction (1%)`,
                    divisionId: lineDivId
                });
            } else {
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(po.amountDue.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal (Non-VAT)`,
                    divisionId: lineDivId
                });
            }
        });
        return newPayables;
    }, [divisionId]);

    const handleImportPos = useCallback(() => {
        const selected = unpaidPos.filter(po => selectedPoIds.includes(po.uniqueKey));
        const newPayables = calculateTaxedPayables(selected, taxTypes, today);

        setPayables((prev) => [...prev, ...newPayables]);
        setIsPoModalOpen(false);
        toast.success(`Imported ${selected.length} record(s) successfully`);
    }, [unpaidPos, selectedPoIds, taxTypes, today, calculateTaxedPayables]);

    const handleOpenMemoModal = async () => {
        if (!payeeId) return toast.error("Please select a Payee first.");
        setLoadingMemos(true);
        setIsMemoModalOpen(true);
        try {
            const fetchedMemos = await disbursementProvider.getSupplierMemos(Number(payeeId));
            setMemos(fetchedMemos);
        } catch {
            toast.error("Failed to load supplier memos");
            setIsMemoModalOpen(false);
        } finally {
            setLoadingMemos(false);
        }
    };

    const handleApplyMemo = (memo: MemoDto) => {
        const isCredit = memo.type === 1;
        const finalAmount = isCredit ? -Math.abs(memo.amount) : Math.abs(memo.amount);

        setPayables([...payables, {
            referenceNo: memo.memo_number,
            date: today,
            amount: finalAmount,
            coaId: memo.coa_id,
            remarks: `${memo.memo_type_name}: ${memo.reason || 'Applied to voucher'}`,
            divisionId: divisionId ? Number(divisionId) : undefined
        }]);

        setIsMemoModalOpen(false);
        toast.success(`${memo.memo_type_name} applied successfully!`);
    };

    // Derived State
    const totalAmount = useMemo(() => {
        return payables.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
    }, [payables]);

    // Handlers for payable line editing
    const handleAddPayable = () => {
        const newLine: PayableLine = {
            coaId: undefined,
            divisionId: undefined,
            referenceNo: "",
            date: "",
            amount: 0,
            remarks: ""
        };
        setPayables([...payables, newLine]);
    };

    const handleRemovePayable = (idx: number) => {
        setPayables(payables.filter((_, i) => i !== idx));
    };

    const handlePayableChange = <K extends keyof PayableLine>(idx: number, key: K, val: PayableLine[K]) => {
        const copy = [...payables];
        copy[idx] = { ...copy[idx], [key]: val };
        setPayables(copy);
    };

    // Supporting File Uploading
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/fm/treasury/disbursements/upload", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            const cleanUrl = data.data?.id || data.url || data.uuid || data.id || "";
            setSupportingDocumentsUrl(cleanUrl);
            toast.success("Supporting document uploaded successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to upload supporting document.");
        } finally {
            setUploading(false);
        }
    };

    // Submit for approval (Draft -> Submitted)
    const handleSave = async (submitImmediate: boolean) => {
        let hasError = false;
        if (!payeeId) hasError = true;
        if (!departmentId) hasError = true;
        if (!transactionDate) hasError = true;

        if (hasError) {
            setShowValidationErrors(true);
            toast.error("Please fill out all required fields marked in red.");
            return;
        }

        if (payables.length === 0) {
            toast.error("Please add at least one payable allocation line item.");
            return;
        }

        // Validate line items
        for (let i = 0; i < payables.length; i++) {
            const p = payables[i];
            if (!p.coaId) {
                toast.error(`Please select a GL COA account on payable row ${i + 1}`);
                return;
            }
            if (Number(p.amount) === 0) {
                toast.error(`Amount cannot be zero on payable row ${i + 1}`);
                return;
            }
        }

        // Integrity Verification Equation Check: total_amount = sum(payables.amount)
        const payablesSum = payables.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const diff = Math.abs(totalAmount - payablesSum);
        if (diff > 0.01) {
            toast.error("Submission blocked: Calculated total amount does not equal the sum of payable lines.");
            return;
        }

        setSubmitting(true);
        const payload: DisbursementPayload = {
            transactionTypeId,
            payeeId: Number(payeeId),
            remarks,
            totalAmount,
            transactionDate,
            divisionId: divisionId ? Number(divisionId) : undefined,
            departmentId: departmentId ? Number(departmentId) : undefined,
            supportingDocumentsUrl,
            payables,
            payments: [] // New/Edited vouchers start released payments blank
        };

        try {
            let voucher: Disbursement;
            if (activeVoucher) {
                // Update
                voucher = await disbursementProvider.updateDisbursement(activeVoucher.id, payload);
                if (submitImmediate) {
                    voucher = await disbursementProvider.updateStatus(activeVoucher.id, "Submitted");
                }
                toast.success("Voucher updated successfully");
            } else {
                // Create
                voucher = await disbursementProvider.createDisbursement(payload);
                if (submitImmediate) {
                    voucher = await disbursementProvider.updateStatus(voucher.id, "Submitted");
                }
                toast.success("Voucher created successfully");
            }

            setCreatedDisbursement(voucher);
            if (submitImmediate) {
                setShowPrintModal(true);
            }
            
            // Clear current editor selection and refresh the list
            setLocalEditVoucher(null);
            fetchEditableVouchers();

            if (onSuccess) onSuccess();
        } catch (err: unknown) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to save disbursement voucher.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full items-start">
            {/* 📋 LEFT SIDEBAR: EDITABLE RECORDS LIST */}
            {isSidebarOpen && (
                <div className="w-full xl:w-[320px] shrink-0">
                    <Card className="border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col max-h-[85vh] w-full">
                <CardHeader className="bg-muted/10 border-b border-border/50 py-3 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle className="text-xs font-black uppercase text-foreground">Editable Vouchers</CardTitle>
                        <CardDescription className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Draft or Returned items</CardDescription>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={fetchEditableVouchers}
                        disabled={loadingVouchers}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loadingVouchers && "animate-spin")} />
                    </Button>
                </CardHeader>
                <CardContent className="p-3 overflow-y-auto flex-1 space-y-2 custom-scrollbar bg-muted/5 flex flex-col min-h-0">
                    <Button
                        variant="outline"
                        onClick={() => setLocalEditVoucher(null)}
                        className={cn(
                            "w-full h-10 text-[10px] font-black uppercase tracking-widest border-dashed border-primary/45 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-sm shrink-0",
                            !activeVoucher && "bg-primary/10 border-solid"
                        )}
                    >
                        <PlusCircle className="w-4 h-4" /> New Voucher
                    </Button>

                    <div className="h-px bg-border/40 my-2 shrink-0" />

                    {/* Sleek Search & Filters */}
                    <div className="space-y-2 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-70" />
                            <Input
                                placeholder="Search doc no or payee..."
                                value={sidebarSearch}
                                onChange={(e) => setSidebarSearch(e.target.value)}
                                className="pl-8 h-8 text-[10px] font-bold uppercase bg-background border-border/80"
                            />
                        </div>

                        {/* Status Filter Badges */}
                        <div className="flex flex-wrap gap-1">
                            <Button
                                variant={sidebarStatusFilter === "All" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarStatusFilter("All")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                All Status
                            </Button>
                            <Button
                                variant={sidebarStatusFilter === "Draft" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarStatusFilter("Draft")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                Draft
                            </Button>
                            <Button
                                variant={sidebarStatusFilter === "Returned for Revision" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarStatusFilter("Returned for Revision")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                Returned
                            </Button>
                        </div>

                        {/* Type Filter Badges */}
                        <div className="flex flex-wrap gap-1 pb-1">
                            <Button
                                variant={sidebarTypeFilter === "All" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarTypeFilter("All")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                All Types
                            </Button>
                            <Button
                                variant={sidebarTypeFilter === "Trade" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarTypeFilter("Trade")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                Trade
                            </Button>
                            <Button
                                variant={sidebarTypeFilter === "Non-Trade" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setSidebarTypeFilter("Non-Trade")}
                                className="h-6 text-[8px] font-black uppercase px-2 py-0 rounded-md"
                            >
                                Non-Trade
                            </Button>
                        </div>

                        {/* Date Range & Payee Filters */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Start Date</Label>
                                <Input
                                    type="date"
                                    value={sidebarStartDate}
                                    onChange={(e) => setSidebarStartDate(e.target.value)}
                                    className="h-7 text-[9px] font-bold bg-background border-border/60"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">End Date</Label>
                                <Input
                                    type="date"
                                    value={sidebarEndDate}
                                    onChange={(e) => setSidebarEndDate(e.target.value)}
                                    className="h-7 text-[9px] font-bold bg-background border-border/60"
                                />
                            </div>
                        </div>

                        <div className="space-y-1 pt-1">
                            <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Filter Payee</Label>
                            <select
                                className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[9px] font-bold uppercase outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer text-foreground"
                                value={sidebarPayeeId}
                                onChange={(e) => setSidebarPayeeId(e.target.value === "" ? "" : Number(e.target.value))}
                            >
                                <option value="">All Payees</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.supplier_name}</option>
                                ))}
                            </select>
                        </div>

                        {(sidebarStartDate || sidebarEndDate || sidebarPayeeId !== "") && (
                            <Button
                                onClick={() => {
                                    setSidebarStartDate("");
                                    setSidebarEndDate("");
                                    setSidebarPayeeId("");
                                }}
                                variant="ghost"
                                className="w-full h-6 text-[8px] font-black uppercase text-destructive hover:bg-destructive/5 mt-1 border border-dashed border-destructive/25"
                            >
                                Clear Extra Filters
                            </Button>
                        )}
                    </div>

                    <div className="h-px bg-border/40 my-1 shrink-0" />

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {loadingVouchers ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                                <Loader2 className="animate-spin text-primary w-5 h-5" /> Syncing list...
                            </div>
                        ) : filteredEditableVouchers.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">
                                No matching vouchers.
                            </div>
                        ) : (
                            filteredEditableVouchers.map((v) => {
                                const isActive = activeVoucher?.id === v.id;
                                const isReturned = v.status.includes("Returned") || v.status.includes("Reject");
                            return (
                                <div
                                    key={v.id}
                                    onClick={() => setLocalEditVoucher(v)}
                                    className={cn(
                                        "p-3 rounded-xl border cursor-pointer transition-all hover:bg-muted/40 flex flex-col gap-2 relative overflow-hidden",
                                        isActive 
                                            ? "border-primary bg-primary/[0.03] shadow-sm" 
                                            : "border-border bg-card",
                                        isReturned && "border-l-4 border-l-rose-500"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-black uppercase text-foreground">{v.docNo}</span>
                                        <Badge className={cn(
                                            "text-[7px] font-black px-1.5 py-0 h-4 border uppercase tracking-wider",
                                            isReturned 
                                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                                : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                        )}>
                                            {v.status}
                                        </Badge>
                                    </div>
                                    <div className="text-[10px] font-black text-foreground truncate uppercase">{v.payeeName}</div>
                                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase mt-1">
                                        <span>{v.transactionDate ? format(parseLocalDate(v.transactionDate), "MMM dd, yyyy") : "No Date"}</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-500">{formatCurrency(v.totalAmount)}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    </div>
                </CardContent>
            </Card>
                </div>
            )}

            {/* 📝 RIGHT WORKSPACE: VOUCHER EDITOR FORM */}
            <div className="flex-1 min-w-0 w-full space-y-6 flex flex-col">
                <Card className="shadow-md border-border/60 bg-card rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                    <CardHeader className="border-b bg-muted/5 py-4">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsSidebarOpen(prev => !prev)}
                                    className="h-9 w-9 p-0 mr-1 shrink-0 rounded-lg hover:bg-muted/85 transition-all duration-200"
                                    title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                                >
                                    {isSidebarOpen ? <PanelLeftClose className="w-4.5 h-4.5 text-primary" /> : <PanelLeftOpen className="w-4.5 h-4.5 text-primary" />}
                                </Button>
                                <FileText className="w-4.5 h-4.5 text-primary opacity-80" />
                                {activeVoucher ? `Edit Voucher ${activeVoucher.docNo}` : "New Disbursement Voucher"}
                            </span>
                            <div className="flex items-center gap-2">
                                {!isSidebarOpen && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="h-8 text-[10px] font-bold uppercase border-primary/30 text-primary hover:bg-primary/5 rounded-lg px-2.5"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5 mr-1" /> Load Drafts
                                    </Button>
                                )}
                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">Submodule 1: Preparation</Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {loadingData ? (
                            <div className="py-20 flex justify-center items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                                <Loader2 className="animate-spin text-primary" /> Loading Metadata...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Inputs */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider">Transaction Type</Label>
                                    <select 
                                        className="h-10 w-full rounded-lg border border-border/80 bg-background px-3 text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                                        value={transactionTypeId}
                                        onChange={e => setTransactionTypeId(Number(e.target.value))}
                                    >
                                        <option value={1}>Trade Supplier</option>
                                        <option value={2}>Non-Trade / Expense</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider flex justify-between">
                                        Payee / Supplier <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="flex gap-2 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <Popover open={payeeOpen} onOpenChange={setPayeeOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full min-w-0 h-10 text-xs font-bold justify-between bg-background border-border/80 px-3 uppercase text-left", showValidationErrors && !payeeId && "border-rose-500 hover:border-rose-600 focus:ring-rose-500/20")}>
                                                        <span className="truncate flex-1 pr-1">{suppliers.find(s => s.id === payeeId)?.supplier_name || "Select Payee..."}</span>
                                                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-55" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[320px] p-0" align="start">
                                                    <Command filter={(value, search) => {
                                                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                                                        return 0;
                                                    }}>
                                                        <CommandInput placeholder="Search payee..." className="h-9" />
                                                        <CommandList className="max-h-[220px]">
                                                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-bold">No Payee Found.</CommandEmpty>
                                                            <CommandGroup>
                                                                 {suppliers
                                                                     .filter(s => transactionTypeId === 1 ? s.supplier_type === "TRADE" : s.supplier_type === "NON-TRADE")
                                                                     .map(s => (
                                                                         <CommandItem 
                                                                             key={s.id} 
                                                                             value={s.supplier_name.toLowerCase()} 
                                                                             onSelect={() => { handlePayeeSelect(s.id); setPayeeOpen(false); }}
                                                                             className="text-xs font-bold uppercase cursor-pointer"
                                                                         >
                                                                             <Check className={cn("mr-2 h-4 w-4 text-primary", payeeId === s.id ? "opacity-100" : "opacity-0")} />
                                                                             {s.supplier_name}
                                                                         </CommandItem>
                                                                     ))
                                                                 }
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        {!isNonTradeVoucher && (
                                            <Button type="button" onClick={() => handleOpenPoModal()} disabled={!payeeId}
                                                    className="h-10 px-3 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shrink-0"
                                                    title="Pull Unpaid POs">
                                                <DownloadCloud className="w-4 h-4"/>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                     <Label className="text-[10px] font-black uppercase tracking-wider">Transaction Date <span className="text-destructive">*</span></Label>
                                     <Input type="date" className={cn("h-10 text-xs font-bold uppercase bg-background border-border/80", showValidationErrors && !transactionDate && "border-rose-500 focus:ring-rose-500/30")} value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
                                 </div>

                                 <div className="space-y-2">
                                     <Label className="text-[10px] font-black uppercase tracking-wider">Voucher Limit (Calculated)</Label>
                                     <div className="h-10 flex items-center px-4 bg-muted/40 border border-border/85 rounded-lg text-sm font-black text-emerald-600 dark:text-emerald-500">
                                         {formatCurrency(totalAmount)}
                                     </div>
                                 </div>

                                 <div className="space-y-2 flex flex-col justify-end">
                                     <Label className="text-[10px] font-black uppercase tracking-wider mb-1.5">Cost Department <span className="text-destructive">*</span></Label>
                                     <SearchSelect
                                         options={departmentOptions}
                                         value={departmentId !== "" ? Number(departmentId) : ""}
                                         onSelect={val => setDepartmentId(Number(val))}
                                         placeholder="Select Department..."
                                         className={cn("h-10 text-xs font-bold bg-background border-border/80", showValidationErrors && !departmentId && "border-rose-500 ring-rose-500/20")}
                                     />
                                 </div>

                                 <div className="space-y-2 sm:col-span-2">
                                     <Label className="text-[10px] font-black uppercase tracking-wider">Voucher Remarks</Label>
                                     <Input className="h-10 text-xs font-bold bg-background border-border/80" placeholder="e.g. Purchase of office supplies" value={remarks} onChange={e => setRemarks(e.target.value)} />
                                 </div>

                                 {/* Supporting Doc Upload */}
                                 <div className="space-y-2 sm:col-span-2 lg:col-span-4 border-t border-dashed border-border pt-4">
                                     <Label className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><UploadCloud className="w-3.5 h-3.5" /> Supporting Document File</Label>
                                     <div className="flex items-center gap-4">
                                         <Input type="file" onChange={handleFileUpload} disabled={uploading} className="max-w-[320px] text-xs cursor-pointer" />
                                         {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                         {supportingDocumentsUrl && (
                                             <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/35 text-emerald-600 dark:text-emerald-400 font-bold max-w-[400px] truncate">
                                                 Doc URL: {supportingDocumentsUrl}
                                             </Badge>
                                         )}
                                     </div>
                                 </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payables allocation Grid */}
                <Card className="shadow-md border-border/60 bg-card rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                    <CardHeader className="border-b bg-muted/5 py-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                            <Calculator className="w-4.5 h-4.5 text-emerald-500 opacity-80" />
                            Debit Payables & Accounts Allocation
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={handleOpenMemoModal} 
                                disabled={loadingData || !payeeId} 
                                size="sm" 
                                className="h-9 px-4 font-bold uppercase tracking-widest text-[10px] text-purple-600 hover:bg-purple-50 hover:text-purple-700 border-purple-200 dark:border-purple-800/50 dark:hover:bg-purple-900/20"
                            >
                                <FileText className="w-3.5 h-3.5 mr-1" /> Apply Memo
                            </Button>
                            <Button 
                                onClick={handleAddPayable} 
                                disabled={loadingData} 
                                size="sm" 
                                className="h-9 px-4 font-black uppercase tracking-widest text-[10px]"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Debit Line
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <StickyTableWrapper className="max-h-[38vh] overflow-auto custom-scrollbar">
                            <Table className="min-w-[1100px] table-fixed">
                                <TableHeader className="bg-muted/70 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[220px]">GL Account (COA)</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[160px]">Cost Division</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[160px]">Reference / PO</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[130px]">Invoice Date</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[160px] text-right">Amount (PHP)</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground w-[210px]">Line Remarks</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payables.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-28 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                 No debit accounts allocated yet. Click &quot;Add Debit Line&quot; above.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        payables.map((line, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/5">
                                                {/* COA select */}
                                                <TableCell className="py-2.5">
                                                    <SearchSelect
                                                        options={coaOptions}
                                                        value={line.coaId != null ? line.coaId : ""}
                                                        onSelect={val => handlePayableChange(idx, "coaId", val)}
                                                        placeholder="Select GL Account..."
                                                        className="h-9 font-bold text-xs bg-background"
                                                    />
                                                </TableCell>

                                                {/* Cost Division select */}
                                                <TableCell className="py-2.5">
                                                    <SearchSelect
                                                        options={divisionOptions}
                                                        value={line.divisionId != null ? line.divisionId : ""}
                                                        onSelect={val => handlePayableChange(idx, "divisionId", val)}
                                                        placeholder="Select Division..."
                                                        className="h-9 font-bold text-xs bg-background"
                                                    />
                                                </TableCell>

                                                {/* Ref No */}
                                                <TableCell className="py-2.5">
                                                    <Input 
                                                        className="h-9 text-xs font-bold bg-background border-border/80" 
                                                        placeholder="PO-0001" 
                                                        value={line.referenceNo} 
                                                        onChange={e => handlePayableChange(idx, "referenceNo", e.target.value)} 
                                                    />
                                                </TableCell>

                                                {/* Date */}
                                                <TableCell className="py-2.5">
                                                    <Input 
                                                        type="date"
                                                        className="h-9 text-xs font-bold bg-background border-border/80" 
                                                        value={line.date} 
                                                        onChange={e => handlePayableChange(idx, "date", e.target.value)} 
                                                    />
                                                </TableCell>

                                                {/* Amount */}
                                                <TableCell className="py-2.5">
                                                    <Input 
                                                        type="number"
                                                        className="h-9 text-xs font-bold bg-background border-border/80 text-right font-mono" 
                                                        placeholder="0.00"
                                                        value={line.amount || ""} 
                                                        onChange={e => handlePayableChange(idx, "amount", e.target.value === "" ? 0 : Number(e.target.value))} 
                                                    />
                                                </TableCell>

                                                {/* Remarks */}
                                                <TableCell className="py-2.5">
                                                    <Input 
                                                        className="h-9 text-xs font-bold bg-background border-border/80" 
                                                        placeholder="Allocation details" 
                                                        value={line.remarks || ""} 
                                                        onChange={e => handlePayableChange(idx, "remarks", e.target.value)} 
                                                    />
                                                </TableCell>

                                                {/* Remove Button */}
                                                <TableCell className="py-2.5 text-center">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleRemovePayable(idx)} 
                                                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </StickyTableWrapper>
                    </CardContent>
                </Card>

                {/* Actions Bar */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button 
                        variant="outline" 
                        onClick={() => handleSave(false)} 
                        disabled={submitting} 
                        className="h-11 px-6 font-bold uppercase tracking-widest text-xs border-border/80"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2 text-muted-foreground" />}
                        Save as Draft
                    </Button>
                    <Button 
                        onClick={() => handleSave(true)} 
                        disabled={submitting} 
                        className="h-11 px-8 font-black uppercase tracking-widest text-xs shadow-md shadow-primary/20 hover:shadow-lg transition-all"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                        Submit for Approval
                    </Button>
                </div>
            </div>

            {/* 🌟 INSTANT PRINT DIALOG (Submodule 1 Feature Integration) 🌟 */}
            <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
                <DialogContent className="max-w-[95vw] sm:max-w-[460px] w-full border-border shadow-2xl p-6 bg-background rounded-2xl text-center">
                    <DialogHeader className="flex flex-col items-center">
                        <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
                            <Check className="w-8 h-8 stroke-[3]" />
                        </div>
                        <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">Voucher Submitted Successfully!</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                            Voucher No: {createdDisbursement?.docNo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-6 p-4 rounded-xl bg-muted/40 border border-border/40 text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                        Do you want to print a copy of this voucher for physical records or ledger archiving now?
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                if (createdDisbursement) generateDisbursementPDF(createdDisbursement, "A4");
                            }}
                            className="h-10 text-xs font-black uppercase tracking-widest border-border/60 hover:bg-muted"
                        >
                            <Printer className="w-3.5 h-3.5 mr-2 text-blue-500" /> Print A4
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                if (createdDisbursement) generateDisbursementPDF(createdDisbursement, "58mm");
                            }}
                            className="h-10 text-xs font-black uppercase tracking-widest border-border/60 hover:bg-muted"
                        >
                            <Printer className="w-3.5 h-3.5 mr-2 text-amber-500" /> Print Thermal
                        </Button>
                        <Button 
                            onClick={() => setShowPrintModal(false)}
                            className="h-10 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* UNPAID POs SELECTION MODAL */}
            <Dialog open={isPoModalOpen} onOpenChange={setIsPoModalOpen}>
                <DialogContent className="sm:max-w-[750px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2 text-foreground">
                            <DownloadCloud className="w-5 h-5 text-amber-500"/>
                            Pending Records
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Select the records to process for payment, and specify the tax treatment.
                        </DialogDescription>
                    </DialogHeader>

                    {/* SEARCH BAR */}
                    <div className="mt-2 flex items-center gap-2 bg-muted/50 p-2 rounded-md border border-border">
                        <Search className="w-4 h-4 text-muted-foreground ml-2"/>
                        <Input
                            placeholder="Search by PO # or Invoice #..."
                            value={poSearchQuery}
                            onChange={(e) => setPoSearchQuery(e.target.value)}
                            className="h-8 text-xs font-bold uppercase bg-background border-none shadow-none focus-visible:ring-0"
                        />
                    </div>

                    <StickyTableWrapper className="max-h-[350px] overflow-auto border border-border rounded-md mt-2 custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                <TableRow className="border-border">
                                    <TableHead className="w-[40px] text-center"></TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PO Number</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary">Invoice #</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[160px]">Tax Classification</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingPos ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-sm font-medium text-muted-foreground">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/> Loading Records...
                                        </TableCell>
                                    </TableRow>
                                ) : unpaidPos.filter(po => {
                                    const matchesSearch = po.poNo.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
                                        (po.receiptNo && po.receiptNo.toLowerCase().includes(poSearchQuery.toLowerCase()));
                                    const isAlreadyImported = payables.some(p => p.referenceNo.startsWith(`${po.poNo} / ${po.receiptNo}`));
                                    return matchesSearch && !isAlreadyImported;
                                }).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-sm font-medium text-muted-foreground">
                                            No matching records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    unpaidPos.filter(po => {
                                        const matchesSearch = po.poNo.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
                                            (po.receiptNo && po.receiptNo.toLowerCase().includes(poSearchQuery.toLowerCase()));
                                        const isAlreadyImported = payables.some(p => p.referenceNo.startsWith(`${po.poNo} / ${po.receiptNo}`));
                                        return matchesSearch && !isAlreadyImported;
                                    }).map(po => (
                                        <TableRow key={po.uniqueKey} className="cursor-pointer hover:bg-muted/50 border-border" onClick={() => {
                                            const isChecking = !selectedPoIds.includes(po.uniqueKey);
                                            setSelectedPoIds(prev => isChecking ? [...prev, po.uniqueKey] : prev.filter(id => id !== po.uniqueKey));
                                            if (isChecking && !taxTypes[po.uniqueKey]) {
                                                setTaxTypes(prev => ({...prev, [po.uniqueKey]: "VAT"}));
                                            }
                                        }}>
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={selectedPoIds.includes(po.uniqueKey)} onCheckedChange={(checked) => {
                                                    if (checked === true) {
                                                        setSelectedPoIds(prev => prev.includes(po.uniqueKey) ? prev : [...prev, po.uniqueKey]);
                                                        if (!taxTypes[po.uniqueKey]) setTaxTypes(prev => ({ ...prev, [po.uniqueKey]: "VAT" }));
                                                    } else {
                                                        setSelectedPoIds(prev => prev.filter(id => id !== po.uniqueKey));
                                                    }
                                                }}/>
                                            </TableCell>
                                            <TableCell className="font-bold text-xs uppercase flex flex-col gap-1 text-foreground mt-1.5 border-none">
                                                <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground"/> {po.poNo}</div>
                                                <span className="text-[9px] text-muted-foreground font-medium ml-4.5">{po.date ? format(parseLocalDate(po.date), "MMM dd, yyyy") : "No Date"}</span>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-primary uppercase">
                                                <div className="flex flex-col gap-1">
                                                    {po.receiptNo}
                                                    {po.type === 'CWO' && <Badge variant="outline" className="w-fit text-[8px] bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Cash With Order</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    className="h-7 w-full rounded-sm border border-input bg-background px-1 text-[10px] font-bold text-foreground shadow-sm disabled:opacity-30"
                                                    value={taxTypes[po.uniqueKey] || "VAT"}
                                                    onChange={(e) => setTaxTypes({ ...taxTypes, [po.uniqueKey]: e.target.value as "VAT" | "NON_VAT" })} 
                                                    disabled={!selectedPoIds.includes(po.uniqueKey)}
                                                >
                                                    <option value="VAT">VAT Registered</option>
                                                    <option value="NON_VAT">Non-Registered (No VAT)</option>
                                                </select>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-right text-emerald-600 dark:text-emerald-500">₱ {po.amountDue.toLocaleString('en-US', {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </StickyTableWrapper>

                    <DialogFooter className="mt-4 border-t border-border pt-4">
                        <Button variant="outline" onClick={() => setIsPoModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                        <Button onClick={handleImportPos} disabled={selectedPoIds.length === 0} className="text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white">
                            Import {selectedPoIds.length} Record(s)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SUPPLIER MEMOs SELECTION MODAL */}
            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[700px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2 text-foreground">
                            <FileText className="w-5 h-5 text-purple-500"/>
                            Available Supplier Memos
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Select a Credit or Debit memo to apply to this voucher&apos;s payables.
                        </DialogDescription>
                    </DialogHeader>

                    <StickyTableWrapper className="max-h-[400px] overflow-auto border border-border rounded-md mt-4 custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                <TableRow className="border-border">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Memo No</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type / Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GL Account & Reason</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingMemos ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-sm font-medium text-muted-foreground">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/> Fetching Memos...
                                        </TableCell>
                                    </TableRow>
                                ) : memos.filter(memo => !payables.some(p => p.referenceNo === memo.memo_number)).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-sm font-medium text-muted-foreground">
                                            No available memos found for this supplier.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    memos.filter(memo => !payables.some(p => p.referenceNo === memo.memo_number)).map(memo => (
                                        <TableRow key={memo.id} className="hover:bg-muted/50 border-border">
                                            <TableCell className="font-bold text-xs uppercase text-foreground">{memo.memo_number}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[9px] uppercase ${memo.type === 1 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-600 border-red-200 bg-red-50'}`}>
                                                    {memo.memo_type_name}
                                                </Badge>
                                                <div className="text-[9px] text-muted-foreground mt-1 font-medium">{format(parseLocalDate(memo.date), "MMM dd, yyyy")}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-[10px] font-black uppercase text-foreground">{memo.account_title}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{memo.reason || "N/A"}</div>
                                            </TableCell>
                                            <TableCell className={`text-xs font-black text-right ${memo.type === 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {memo.type === 1 ? '-' : '+'} ₱{memo.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleApplyMemo(memo)} className="h-7 text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white">
                                                    Apply
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </StickyTableWrapper>
                </DialogContent>
            </Dialog>
        </div>
    );
}
