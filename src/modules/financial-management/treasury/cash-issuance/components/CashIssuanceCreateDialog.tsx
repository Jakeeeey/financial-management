"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Search, FileText, DownloadCloud, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
    DisbursementPayload, DisbursementSubmitResult, PayableLine, SupplierDto, COADto,
    Disbursement, UnpaidPoDto, MemoDto, DivisionDto, DepartmentDto, PaymentLine, BankAccountDto
} from "../types";
import { disbursementProvider } from "../providers/fetchProvider";
import { toast } from "sonner";
import { AddPayeeModal } from "@/modules/financial-management/payee-registration/components/modals/add-payee-modal";
import type { Payee } from "@/modules/financial-management/payee-registration/types/payee.schema";
import { formatCurrency } from "../utils/disbursement-utils";
import { VoucherDetailsSection } from "./VoucherDetailsSection";
import { PayablesSection } from "./PayablesSection";
import { StickyTableWrapper } from "./StickyTableWrapper";
import { SearchableDropdown } from "./SearchableDropdown";
import { replaceEmptyPayablePlaceholders } from "@/modules/financial-management/treasury/components/payable-line-state";
import { getMemoAvailableAmount } from "@/modules/financial-management/treasury/components/memo-cap";
import { normalizeMemoReference, stripMemoLineMetadata } from "@/modules/financial-management/treasury/components/memo-payable-line";
import { isPettyCashAccount, validatePaymentLine } from "@/app/api/fm/treasury/disbursements/_payment-method";
import { cn } from "@/lib/utils";

export interface ExtendedDisbursement extends Disbursement {
    payeeId?: number;
    departmentId?: number;
}

interface CashIssuanceCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: DisbursementPayload) => Promise<DisbursementSubmitResult>;
    loading: boolean;
    editData?: ExtendedDisbursement | null;
    allowPaymentEditing?: boolean;
}
const isPaymentCOA = (c: COADto) => {
    return !!c.isPayment;
};

const isPayableOrExpenseCOA = (c: COADto) => !isPaymentCOA(c);

const MEMO_AMOUNT_TOLERANCE = 0.01;

function findMemoForPayableLine(line: PayableLine, memos: MemoDto[]) {
    const reference = normalizeMemoReference(line.memoNumber || line.referenceNo);
    return memos.find((memo) => normalizeMemoReference(memo.memo_number) === reference);
}

function getMemoAmountError(requestedAmount: number, availableAmount: number) {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return "Memo amount must be greater than zero.";
    }
    if (requestedAmount > availableAmount + MEMO_AMOUNT_TOLERANCE) {
        return `Amount cannot exceed the available amount of this credit or debit memo (${formatCurrency(availableAmount)}).`;
    }
    return null;
}

export function CashIssuanceCreateDialog({
    open,
    onOpenChange,
    onSubmit,
    loading,
    editData,
    allowPaymentEditing = false,
}: CashIssuanceCreateDialogProps) {
    const today = new Date().toISOString().split("T")[0];

    const [transactionTypeId, setTransactionTypeId] = useState<number | "">(1);
    const [payeeId, setPayeeId] = useState<number | "">("");
    const [remarks, setRemarks] = useState("");
    const [transactionDate, setTransactionDate] = useState(today);

    const [payables, setPayables] = useState<PayableLine[]>([]);
    const [payments, setPayments] = useState<PaymentLine[]>([]);
    const [banks, setBanks] = useState<BankAccountDto[]>([]);
    const [paymentValidationErrors, setPaymentValidationErrors] = useState<Set<string>>(new Set());

    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const [unpaidPos, setUnpaidPos] = useState<UnpaidPoDto[]>([]);
    const [loadingPos, setLoadingPos] = useState(false);
    const [isPoModalOpen, setIsPoModalOpen] = useState(false);
    const poRequestIdRef = useRef(0);
    const poAbortControllerRef = useRef<AbortController | null>(null);
    const [poLoadError, setPoLoadError] = useState<string | null>(null);
    const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
    const [taxTypes, setTaxTypes] = useState<Record<string, "VAT" | "NON_VAT">>({});

    const [memos, setMemos] = useState<MemoDto[]>([]);
    const [memoAmounts, setMemoAmounts] = useState<Record<string, string>>({});
    const [loadingMemos, setLoadingMemos] = useState(false);
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [supportingDocumentsUrl, setSupportingDocumentsUrl] = useState("");
    const [uploadingFile, setUploadingFile] = useState(false);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    const [poSearchQuery, setPoSearchQuery] = useState("");
    const [isPayeeRegistrationOpen, setIsPayeeRegistrationOpen] = useState(false);
    
    const [previewDocNo, setPreviewDocNo] = useState("");
    const [loadingDocNo, setLoadingDocNo] = useState(false);
    const [localSubmitting, setLocalSubmitting] = useState(false);
    const submitLockRef = useRef(false);

    const isReleasingEdit = !!(editData && editData.status === "Approved");
    const isPaymentEditorEnabled = allowPaymentEditing && isReleasingEdit;
    const isReadOnly = !!(editData && (
        editData.status === "Released" || 
        editData.status === "Posted" || 
        (editData.status === "Submitted" && !editData.transactionTypeName?.toUpperCase().includes("NON"))
    ));

    const isHeaderLocked = isReleasingEdit || isReadOnly;
    const isPayablesLocked = isReleasingEdit || isReadOnly;
    const arePaymentFieldsLocked = !isPaymentEditorEnabled || isReadOnly;

    const totalAmount = useMemo(() => payables.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [payables]);
    const memoReferences = useMemo(
        () => new Set(memos.map((memo) => normalizeMemoReference(memo.memo_number)).filter(Boolean)),
        [memos],
    );
    const memoAmountErrors = useMemo(() => {
        const errors: Record<number, string> = {};

        payables.forEach((line, index) => {
            const memo = findMemoForPayableLine(line, memos);
            if (!memo) return;

            const availableAmount = getMemoAvailableAmount(
                memo.remaining_amount ?? memo.amount,
                payables,
                memo.memo_number,
                index,
            );
            const error = getMemoAmountError(Math.abs(Number(line.amount) || 0), availableAmount);
            if (error) errors[index] = error;
        });

        return errors;
    }, [memos, payables]);

    const isNonTradeVoucher = transactionTypeId === 2;
    const payeeSupplierType = isNonTradeVoucher ? "NON-TRADE" : "TRADE";
    const payeeSupplierTypeLabel = isNonTradeVoucher ? "Non-Trade" : "Trade";

    useEffect(() => {
        if (open) {
            Promise.all([
                disbursementProvider.getCOAs(),
                disbursementProvider.getBanks(),
            ]).then(([coaList, bankList]) => {
                setCoas(Array.isArray(coaList) ? coaList : []);
                setBanks(Array.isArray(bankList) ? bankList : []);
            }).catch(() => {
                setCoas([]);
                setBanks([]);
            });
            disbursementProvider.getDivisions().then(res => setDivisions(Array.isArray(res) ? res : [])).catch(() => console.warn("No divisions route"));
            disbursementProvider.getDepartments().then(res => setDepartments(Array.isArray(res) ? res : [])).catch(() => console.warn("No departments route"));
        }
    }, [open]);

    useEffect(() => {
        if (open && transactionTypeId) {
            setLoadingData(true);
            const typeString = transactionTypeId === 1 ? "TRADE" : "NON-TRADE";
            disbursementProvider.getSuppliers(typeString)
                .then(res => setSuppliers(Array.isArray(res) ? res : []))
                .finally(() => setLoadingData(false));
        }
    }, [open, transactionTypeId]);

    useEffect(() => {
        if (open && !editData) {
            setLoadingDocNo(true);
            const supplierType = transactionTypeId === 2 ? "Non-Trade" : "Trade";
            disbursementProvider.getNextDocNo(supplierType)
                .then(setPreviewDocNo)
                .catch(err => {
                    console.warn("Failed to load next doc no preview:", err);
                    setPreviewDocNo("");
                })
                .finally(() => setLoadingDocNo(false));
        } else {
            setPreviewDocNo("");
        }
    }, [open, transactionTypeId, editData]);

    useEffect(() => {
        if (open) {
            if (editData) {
                const isNonTrade = editData.transactionTypeName?.toUpperCase().includes("NON");
                setTransactionTypeId(isNonTrade ? 2 : 1);

                setPayeeId(editData.payeeId != null ? Number(editData.payeeId) : "");
                setDepartmentId(editData.departmentId != null ? Number(editData.departmentId) : "");
                setRemarks(editData.remarks || "");
                const docUrl = editData.supportingDocumentsUrl || "";
                const parsedUuid = docUrl.includes("/") ? (docUrl.split("/").pop()?.split("?")[0] || "") : docUrl;
                setSupportingDocumentsUrl(parsedUuid);
                setTransactionDate(editData.transactionDate ? editData.transactionDate.split('T')[0] : today);

                setPayables(editData.payables.map(p => ({
                    id: p.id,
                    referenceNo: p.referenceNo || "",
                    date: p.date ? p.date.split('T')[0] : today,
                    amount: p.amount,
                    memoOriginalAmount: Math.abs(Number(p.amount) || 0),
                    coaId: p.coaId,
                    divisionId: p.divisionId || undefined,
                    remarks: p.remarks,
                    accountTitle: p.accountTitle
                })));
                setPayments(editData.payments.map(p => ({
                    id: p.id,
                    coaId: p.coaId,
                    accountTitle: p.accountTitle,
                    bankId: p.bankId,
                    bankName: p.bankName,
                    bankAccountNumber: p.bankAccountNumber,
                    checkNo: p.checkNo || "",
                    date: p.date ? p.date.split("T")[0] : today,
                    amount: p.amount,
                    remarks: p.remarks || "",
                    releasedDate: p.releasedDate,
                    releasedBy: p.releasedBy,
                })));
                setPaymentValidationErrors(new Set());

            } else {
                setTransactionTypeId(1);
                setPayeeId("");
                setDepartmentId("");
                setRemarks("");
                setSupportingDocumentsUrl("");
                // Start with one blank row for payables so the user can begin typing immediately.
                setPayables([{referenceNo: "", date: today, amount: 0, remarks: "", divisionId: undefined}]);
                setPayments([]);
                setPaymentValidationErrors(new Set());
                setTransactionDate(today);
            }
        }
    }, [open, editData, today]);

    useEffect(() => {
        if (open && editData && !payeeId && editData.payeeName && suppliers.length > 0) {
            const match = suppliers.find(s => s.supplier_name?.toLowerCase() === editData.payeeName?.toLowerCase());
            if (match) setPayeeId(match.id);
        }
    }, [open, editData, payeeId, suppliers]);

    useEffect(() => {
        if (open && editData && !departmentId && editData.departmentName && departments.length > 0) {
            const match = departments.find(d => d.departmentName?.toLowerCase() === editData.departmentName?.toLowerCase());
            if (match) setDepartmentId(match.departmentId);
        }
    }, [open, editData, departmentId, departments]);

    useEffect(() => {
        if (!open || !payeeId) {
            if (open && !payeeId) setMemos([]);
            return;
        }

        let active = true;
        disbursementProvider.getSupplierMemos(Number(payeeId))
            .then((fetchedMemos) => {
                if (active) setMemos(fetchedMemos);
            })
            .catch(() => {
                if (active) setMemos([]);
            });

        return () => {
            active = false;
        };
    }, [open, payeeId]);

    const handleAddPayable = useCallback(() => setPayables((prev) => [...prev, {referenceNo: "", date: today, amount: 0, remarks: "", divisionId: undefined}]), [today]);

    const handleAmountChange = useCallback((index: number, rawValue: string) => {
        const parsedAmount = rawValue.trim() === "" ? 0 : Number(rawValue);

        setPayables((current) => current.map((line, lineIndex) => {
            if (lineIndex !== index) return line;

            if (!Number.isFinite(parsedAmount)) {
                return { ...line, amount: 0 };
            }

            const memo = findMemoForPayableLine(line, memos);
            if (!memo) return { ...line, amount: parsedAmount };

            return {
                ...line,
                amount: memo.type === 1 ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
            };
        }));
    }, [memos]);

    const handlePayeeCreated = useCallback(async (createdPayee?: Payee) => {
        try {
            const refreshed = await disbursementProvider.getSuppliers(payeeSupplierType);
            const nextSuppliers = Array.isArray(refreshed) ? refreshed : [];
            const createdPayeeId = createdPayee?.id;

            setSuppliers(
                createdPayeeId == null || nextSuppliers.some((supplier) => supplier.id === createdPayeeId)
                    ? nextSuppliers
                    : [
                        ...nextSuppliers,
                        {
                            id: createdPayeeId,
                            supplier_name: createdPayee?.supplier_name || "New Payee",
                            isActive: true,
                        },
                    ],
            );
            if (createdPayeeId != null) setPayeeId(createdPayeeId);
            toast.success(`${payeeSupplierTypeLabel} payee created and selected.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Payee created, but the payee list could not be refreshed.");
        }
    }, [payeeSupplierType, payeeSupplierTypeLabel, setPayeeId, setSuppliers]);

    const handleOpenPoModal = useCallback(async (supplierId: number) => {
        if (!Number.isInteger(supplierId) || supplierId <= 0) return toast.error("Please select a Payee first.");

        poAbortControllerRef.current?.abort();
        const controller = new AbortController();
        poAbortControllerRef.current = controller;
        const requestId = ++poRequestIdRef.current;
        setUnpaidPos([]);
        setSelectedPoIds([]);
        setTaxTypes({});
        setPoSearchQuery("");
        setPoLoadError(null);
        setLoadingPos(true);
        setIsPoModalOpen(true);
        try {
            const pos = await disbursementProvider.getUnpaidPos(supplierId, controller.signal);
            if (requestId !== poRequestIdRef.current) return;
            setUnpaidPos(pos);
        } catch (error) {
            if (controller.signal.aborted || requestId !== poRequestIdRef.current) return;
            setPoLoadError(error instanceof Error ? error.message : "Failed to load unpaid POs");
        } finally {
            if (requestId === poRequestIdRef.current) setLoadingPos(false);
        }
    }, []);

    const handlePoModalOpenChange = useCallback((nextOpen: boolean) => {
        setIsPoModalOpen(nextOpen);
        if (!nextOpen) {
            poAbortControllerRef.current?.abort();
            poRequestIdRef.current += 1;
            setLoadingPos(false);
        }
    }, []);

    // Auto-open PO modal when a Trade payee is selected (no extra click needed)
    const handlePayeeSelect = useCallback((val: number) => {
        setPayeeId(val);
        if (!isNonTradeVoucher && val) {
            handleOpenPoModal(val);
        }
    }, [isNonTradeVoucher, handleOpenPoModal]);

    const handlePendingRecordsError = poLoadError ? (
        <TableRow><TableCell colSpan={5}
                              className="h-24 text-center text-sm font-medium text-destructive">
            {poLoadError}
        </TableCell></TableRow>
    ) : null;

    const calculateTaxedPayables = useCallback((selectedPos: UnpaidPoDto[], currentTaxTypes: Record<string, "VAT" | "NON_VAT">, date: string): PayableLine[] => {
        const newPayables: PayableLine[] = [];
        const VAT_RATE = 0.12;
        const EWT_RATE = 0.01;

        selectedPos.forEach(po => {
            const baseRef = `${po.poNo} / ${po.receiptNo}`;
            const taxType = currentTaxTypes[po.uniqueKey] || "VAT";
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
                    divisionId: undefined
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(vatAmount.toFixed(2)),
                    coaId: 9,
                    remarks: `Input VAT (12%)`,
                    divisionId: undefined
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: -Number(ewtAmount.toFixed(2)),
                    coaId: 38,
                    remarks: `EWT Deduction (1%)`,
                    divisionId: undefined
                });
            } else {
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(po.amountDue.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal (Non-VAT)`,
                    divisionId: undefined
                });
            }
        });
        return newPayables;
    }, []);

    const handleImportPos = useCallback(() => {
        const selected = unpaidPos.filter(po => selectedPoIds.includes(po.uniqueKey));
        const newPayables = calculateTaxedPayables(selected, taxTypes, today);

        setPayables((prev) => replaceEmptyPayablePlaceholders(prev, newPayables));
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
            setMemoAmounts(Object.fromEntries(fetchedMemos.map((memo) => [String(memo.id), String(memo.remaining_amount ?? memo.amount)])));
        } catch {
            toast.error("Failed to load supplier memos");
            setIsMemoModalOpen(false);
        } finally {
            setLoadingMemos(false);
        }
    };

    const handleApplyMemo = (memo: MemoDto) => {
        const isCredit = memo.type === 1;
        const remainingAmount = Number(memo.remaining_amount ?? memo.amount) || 0;
        const locallyRemainingAmount = getMemoAvailableAmount(remainingAmount, payables, memo.memo_number);
        const requestedAmount = Number(memoAmounts[String(memo.id)] ?? remainingAmount);
        const memoAmountError = getMemoAmountError(requestedAmount, locallyRemainingAmount);
        if (memoAmountError) {
            return toast.error(memoAmountError);
        }
        const finalAmount = isCredit ? -Math.abs(requestedAmount) : Math.abs(requestedAmount);

        setPayables((previous) => [...previous, {
            isMemo: true,
            memoId: memo.id,
            memoType: memo.type,
            memoNumber: memo.memo_number,
            referenceNo: memo.memo_number,
            date: today,
            amount: finalAmount,
            coaId: memo.coa_id,
            remarks: `${memo.memo_type_name}: ${memo.reason || 'Applied to voucher'}`
        }]);

        setIsMemoModalOpen(false);
        toast.success(`${memo.memo_type_name} applied successfully!`);
    };

    const paymentCoaOptions = useMemo(() => coas.map((coa) => ({
        value: coa.coaId,
        label: `${coa.glCode || "NO-CODE"} - ${coa.accountTitle || "Unknown"}`,
    })), [coas]);

    const handleAddPayment = useCallback(() => {
        const remaining = Number((totalAmount - payments.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)).toFixed(2));
        setPayments((current) => [...current, {
            checkNo: "",
            date: today,
            amount: remaining > 0 ? remaining : 0,
            remarks: "",
        }]);
    }, [payments, today, totalAmount]);

    const handlePaymentChange = <K extends keyof PaymentLine>(index: number, key: K, value: PaymentLine[K]) => {
        setPayments((current) => current.map((line, lineIndex) =>
            lineIndex === index ? { ...line, [key]: value } : line,
        ));
        setPaymentValidationErrors((current) => {
            const next = new Set(current);
            next.delete(`${index}:${String(key)}`);
            if (key === "coaId") {
                next.delete(`${index}:bankId`);
                next.delete(`${index}:checkNo`);
            }
            return next;
        });
    };

    const validatePayments = () => {
        const errors = new Set<string>();
        const messages: string[] = [];

        payments.forEach((line, index) => {
            const selectedCoa = coas.find((coa) => coa.coaId === Number(line.coaId));
            const pettyCash = isPettyCashAccount(selectedCoa?.accountTitle);

            if (!line.date) errors.add(`${index}:date`);
            if (!Number.isFinite(Number(line.amount)) || Number(line.amount) === 0) errors.add(`${index}:amount`);
            if (!line.coaId || !selectedCoa) errors.add(`${index}:coaId`);
            if (!pettyCash && !line.bankId) errors.add(`${index}:bankId`);
            if (!pettyCash && String(line.checkNo || "").trim() === "") errors.add(`${index}:checkNo`);

            const validationError = validatePaymentLine(line, selectedCoa?.accountTitle);
            if (validationError) messages.push(`${validationError} Payment row ${index + 1}`);
        });

        setPaymentValidationErrors(errors);
        if (errors.size > 0) {
            toast.error(`${messages[0] || "Please complete all required payment fields."} Complete the highlighted fields.`);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (loading || isReadOnly || submitLockRef.current) return;
        if (!editData && !previewDocNo) {
            return toast.error("Document number is still loading. Please try again.");
        }
        if (!transactionTypeId) return toast.error("Transaction Type is required.");
        if (!payeeId) return toast.error("Please select a Payee.");
        if (!departmentId) return toast.error("Department is required.");
        if (totalAmount <= 0) return toast.error("Voucher total must be greater than 0.");
        const memoAmountError = Object.values(memoAmountErrors)[0];
        if (memoAmountError) return toast.error(memoAmountError);
        if (isPaymentEditorEnabled && !validatePayments()) return;

        submitLockRef.current = true;
        setLocalSubmitting(true);
        try {
            const payload: DisbursementPayload = {
                docNo: editData ? editData.docNo : (previewDocNo || undefined),
                transactionTypeId: Number(transactionTypeId),
                payeeId: Number(payeeId),
                departmentId: Number(departmentId),
                remarks,
                supportingDocumentsUrl: supportingDocumentsUrl ? (supportingDocumentsUrl.includes("/") ? (supportingDocumentsUrl.split("/").pop()?.split("?")[0] || "") : supportingDocumentsUrl) : "",
                totalAmount: totalAmount,
                transactionDate,
                payables: payables.map(p => stripMemoLineMetadata({
                    ...p,
                    coaId: p.coaId ? Number(p.coaId) : undefined,
                    divisionId: p.divisionId ? Number(p.divisionId) : undefined
                })),
                ...(isPaymentEditorEnabled ? {
                    payments: payments.map((line) => {
                        const selectedCoa = coas.find((coa) => coa.coaId === Number(line.coaId));
                        const pettyCash = isPettyCashAccount(selectedCoa?.accountTitle);
                        return {
                            ...line,
                            coaId: Number(line.coaId),
                            bankId: pettyCash ? undefined : Number(line.bankId),
                            checkNo: pettyCash ? "" : line.checkNo,
                        };
                    }),
                } : {}),
            };
            const result = await onSubmit(payload);
            if (result.code === "DOC_NO_CONFLICT") {
                if (result.nextDocNo) {
                    setPreviewDocNo(result.nextDocNo);
                    toast.warning(`Document number was already used. A new number, ${result.nextDocNo}, is ready. Review and submit again.`);
                } else {
                    toast.warning(result.message || "Document number is already in use. Refresh the voucher number before submitting again.");
                }
            }
            if (result.success) {
                setTransactionTypeId(1);
                setPayeeId("");
                setDepartmentId("");
                setRemarks("");
                setSupportingDocumentsUrl("");
                setPayables([]);
                setPayments([]);
                setPaymentValidationErrors(new Set());
                onOpenChange(false);
            }
        } finally {
            submitLockRef.current = false;
            setLocalSubmitting(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[96vh] p-0 flex flex-col bg-background overflow-hidden border border-border shadow-2xl rounded-xl">
                    <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-lg font-bold text-foreground">
                                {editData ? `Disbursement Voucher [Doc: ${editData.docNo}]` : `New Disbursement Voucher [Doc: ${loadingDocNo ? "..." : (previewDocNo || "AUTO-GENERATED")}]`}
                            </DialogTitle>
                            <DialogDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                {editData ? "Update voucher details and line items." : "Draft a new voucher, select a payee, and assign financial entries."}
                            </DialogDescription>
                        </div>
                        
                        {/* Totals Summary on the right side of the header */}
                        <div className="flex items-center gap-6 text-xs bg-muted/40 border border-border px-4 py-2 rounded-sm select-none self-end sm:self-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Allocated</span>
                                <span className="font-bold text-foreground">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden h-full">
                        {/* LEFT COLUMN: Metadata inputs, attachments & totals */}
                        <div className="md:col-span-4 border-r border-border bg-muted/5 flex flex-col h-full overflow-y-auto scrollbar-thin">
                            <div className="p-5 space-y-5">
                                <VoucherDetailsSection
                                    transactionTypeId={transactionTypeId}
                                    setTransactionTypeId={setTransactionTypeId}
                                    transactionDate={transactionDate}
                                    setTransactionDate={setTransactionDate}
                                    payeeId={payeeId}
                                    handlePayeeSelect={handlePayeeSelect}
                                    suppliers={suppliers}
                                    loadingData={loadingData}
                                    payeeSupplierTypeLabel={payeeSupplierTypeLabel}
                                    isNonTradeVoucher={isNonTradeVoucher}
                                    setIsPayeeRegistrationOpen={setIsPayeeRegistrationOpen}
                                    handleOpenPoModal={handleOpenPoModal}
                                    departments={departments}
                                    departmentId={departmentId}
                                    setDepartmentId={setDepartmentId}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    supportingDocumentsUrl={supportingDocumentsUrl}
                                    setSupportingDocumentsUrl={setSupportingDocumentsUrl}
                                    uploadingFile={uploadingFile}
                                    setUploadingFile={setUploadingFile}
                                    totalAmount={totalAmount}
                                    disabled={isHeaderLocked}
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Table line items */}
                        <div className={cn(
                            "md:col-span-8 flex flex-col h-full scrollbar-thin bg-background",
                            isPaymentEditorEnabled ? "overflow-y-auto" : "overflow-hidden",
                        )}>
                            <div className={cn(
                                "p-6",
                                isPaymentEditorEnabled ? "space-y-6" : "h-full min-h-0 flex flex-col",
                            )}>
                                <PayablesSection
                                    payables={payables}
                                    setPayables={setPayables}
                                    coas={coas}
                                    divisions={divisions}
                                    isPayableOrExpenseCOA={isPayableOrExpenseCOA}
                                    totalAmount={totalAmount}
                                    payeeId={payeeId}
                                    handleAddPayable={handleAddPayable}
                                    handleOpenMemoModal={handleOpenMemoModal}
                                    handleRemovePayable={(idx) => setPayables(payables.filter((_, i) => i !== idx))}
                                    handleAmountChange={handleAmountChange}
                                    formatMoney={formatCurrency}
                                    memoReferences={memoReferences}
                                    memoAmountErrors={memoAmountErrors}
                                    disabled={isPayablesLocked}
                                    isAddDisabled={!departmentId}
                                    fillHeight={!isPaymentEditorEnabled}
                                />

                                {isPaymentEditorEnabled && <div className="bg-card rounded-sm border border-border shadow-sm overflow-hidden text-foreground">
                                    <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-bold text-foreground">Payment details (Check / Cash distribution)</span>
                                        <span className="ml-auto text-[10px] font-semibold text-muted-foreground uppercase">{payments.length} row{payments.length !== 1 ? "s" : ""}</span>
                                    </div>
                                    <div className="p-0.5">
                                        <StickyTableWrapper className="max-h-[360px] overflow-auto custom-scrollbar border-b border-border">
                                            <Table className="border-collapse min-w-[900px]">
                                                <TableHeader className="bg-muted sticky top-0 z-10 border-b border-border">
                                                    <TableRow className="border-border">
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[150px]">Check / Reference No.</TableHead>
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[145px]">Payment Date</TableHead>
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[240px]">Bank / Cash Account</TableHead>
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[260px]">GL Account (Credit) <span className="text-destructive">*</span></TableHead>
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 min-w-[180px]">Memo Description</TableHead>
                                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase h-9 py-1 px-3 w-[120px] text-right">Amount</TableHead>
                                                        <TableHead className="w-[40px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody className="divide-y divide-border bg-card">
                                                    {payments.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">No payment lines added. Click &quot;Add payment line&quot; to allocate.</TableCell>
                                                        </TableRow>
                                                    ) : payments.map((line, index) => {
                                                        const selectedCoa = coas.find((coa) => coa.coaId === Number(line.coaId));
                                                        const pettyCash = isPettyCashAccount(selectedCoa?.accountTitle);
                                                        return (
                                                            <TableRow key={line.id ?? index} className="hover:bg-muted/40 border-b border-border">
                                                                <TableCell className="p-1 align-middle">
                                                                    <Input
                                                                        disabled={arePaymentFieldsLocked || pettyCash}
                                                                        className={cn("h-7 text-xs uppercase bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background shadow-none px-2 text-foreground", paymentValidationErrors.has(`${index}:checkNo`) && "border-rose-500 bg-rose-50/30")}
                                                                        placeholder={pettyCash ? "Not required for petty cash" : "CK-000000"}
                                                                        value={line.checkNo || ""}
                                                                        onChange={(event) => handlePaymentChange(index, "checkNo", event.target.value)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 align-middle">
                                                                    <Input
                                                                        type="date"
                                                                        disabled={arePaymentFieldsLocked}
                                                                        className={cn("h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background shadow-none px-2 text-foreground", paymentValidationErrors.has(`${index}:date`) && "border-rose-500 bg-rose-50/30")}
                                                                        value={line.date || ""}
                                                                        onChange={(event) => handlePaymentChange(index, "date", event.target.value)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 align-middle">
                                                                    <SearchableDropdown<number>
                                                                        options={banks.map((bank) => ({ value: bank.bankId, label: `${bank.bankName} - ${bank.accountNumber}` }))}
                                                                        value={line.bankId || ""}
                                                                        onSelect={(value) => handlePaymentChange(index, "bankId", value)}
                                                                        placeholder={pettyCash ? "Not required for petty cash" : "Select bank / cash account..."}
                                                                        disabled={arePaymentFieldsLocked || pettyCash}
                                                                        className={cn("h-7 w-full bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background text-xs rounded-sm shadow-none px-2 text-foreground", paymentValidationErrors.has(`${index}:bankId`) && "border-rose-500 bg-rose-50/30")}
                                                                        popoverWidth="w-[360px]"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 align-middle">
                                                                    <SearchableDropdown<number>
                                                                        options={paymentCoaOptions}
                                                                        value={line.coaId || ""}
                                                                        onSelect={(value) => {
                                                                            const nextCoa = coas.find((coa) => coa.coaId === value);
                                                                            handlePaymentChange(index, "coaId", value);
                                                                            if (isPettyCashAccount(nextCoa?.accountTitle)) {
                                                                                setPayments((current) => current.map((payment, paymentIndex) => paymentIndex === index
                                                                                    ? { ...payment, coaId: value, bankId: undefined, checkNo: "" }
                                                                                    : payment));
                                                                            }
                                                                        }}
                                                                        placeholder="Select GL Account (Credit)..."
                                                                        disabled={arePaymentFieldsLocked}
                                                                        className={cn("h-7 w-full bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background text-xs rounded-sm shadow-none px-2 text-foreground", paymentValidationErrors.has(`${index}:coaId`) && "border-rose-500 bg-rose-50/30")}
                                                                        popoverWidth="w-[420px]"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 align-middle">
                                                                    <Input
                                                                        disabled={arePaymentFieldsLocked}
                                                                        className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background shadow-none px-2 text-foreground"
                                                                        placeholder="Line payment info..."
                                                                        value={line.remarks || ""}
                                                                        onChange={(event) => handlePaymentChange(index, "remarks", event.target.value)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 align-middle">
                                                                    <Input
                                                                        type="number"
                                                                        disabled={arePaymentFieldsLocked}
                                                                        className={cn("h-7 text-xs font-bold text-right bg-transparent border-transparent hover:border-input focus:border-primary focus:bg-background shadow-none px-2 text-foreground", paymentValidationErrors.has(`${index}:amount`) && "border-rose-500 bg-rose-50/30")}
                                                                        placeholder="0.00"
                                                                        value={line.amount || ""}
                                                                        onChange={(event) => handlePaymentChange(index, "amount", event.target.value === "" ? 0 : Number(event.target.value))}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="p-1 text-center align-middle">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => {
                                                                            setPayments((current) => current.filter((_, paymentIndex) => paymentIndex !== index));
                                                                            setPaymentValidationErrors(new Set());
                                                                        }}
                                                                        disabled={arePaymentFieldsLocked}
                                                                        className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm disabled:opacity-50"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </StickyTableWrapper>
                                        <div className="px-3 py-2 flex items-center justify-between bg-muted/30">
                                            <Button type="button" variant="outline" size="sm" onClick={handleAddPayment} disabled={arePaymentFieldsLocked} className="h-7 text-[10px] font-bold uppercase">
                                                <Save className="w-3 h-3 mr-1" /> Add payment line
                                            </Button>
                                            <span className="text-[10px] font-black uppercase text-muted-foreground">Total Payments: {formatCurrency(payments.reduce((sum, line) => sum + (Number(line.amount) || 0), 0))}</span>
                                        </div>
                                    </div>
                                </div>}

                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted border-t border-border shrink-0 flex justify-between items-center z-10">
                        <div
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            Lines: {payables.length} Allocated
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}
                                    className="border-input text-foreground hover:bg-accent font-bold text-xs h-9 px-5 rounded-sm">Cancel</Button>
                            <Button onClick={handleSubmit} disabled={loading || localSubmitting || isReadOnly}
                                    className="text-xs font-bold h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm shadow-sm transition-colors">
                                {loading || localSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> :
                                    <Save className="w-4 h-4 mr-2"/>}
                                {editData ? "Save and Close" : "Save and Close"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AddPayeeModal
                open={isPayeeRegistrationOpen}
                onClose={() => setIsPayeeRegistrationOpen(false)}
                onSuccess={handlePayeeCreated}
                supplierType={payeeSupplierType}
            />

            <Dialog open={isPoModalOpen} onOpenChange={handlePoModalOpenChange}>
                <DialogContent className="sm:max-w-[750px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2 text-foreground">
                            <DownloadCloud className="w-5 h-5 text-amber-500"/>
                            Pending Records
                        </DialogTitle>
                        <DialogDescription
                            className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
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
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PO
                                        Number</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-primary">Invoice
                                        #</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[160px]">Tax
                                        Classification</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingPos ? (
                                    <TableRow><TableCell colSpan={5}
                                                         className="h-24 text-center text-sm font-medium text-muted-foreground"><Loader2
                                        className="w-5 h-5 animate-spin mx-auto mb-2"/> Loading
                                        Records...</TableCell></TableRow>
                                ) : poLoadError ? (
                                    handlePendingRecordsError
                                ) : unpaidPos.filter(po =>
                                    po.poNo.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
                                    (po.receiptNo && po.receiptNo.toLowerCase().includes(poSearchQuery.toLowerCase()))
                                ).length === 0 ? (
                                    <TableRow><TableCell colSpan={5}
                                                         className="h-24 text-center text-sm font-medium text-muted-foreground">No
                                        matching records found.</TableCell></TableRow>
                                ) : (
                                    unpaidPos.filter(po =>
                                        po.poNo.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
                                        (po.receiptNo && po.receiptNo.toLowerCase().includes(poSearchQuery.toLowerCase()))
                                    ).map(po => (
                                        <TableRow key={po.uniqueKey}
                                                  className="cursor-pointer hover:bg-muted/50 border-border"
                                                  onClick={() => {
                                                      const isChecking = !selectedPoIds.includes(po.uniqueKey);
                                                      setSelectedPoIds(prev => isChecking ? [...prev, po.uniqueKey] : prev.filter(id => id !== po.uniqueKey));
                                                      if (isChecking && !taxTypes[po.uniqueKey]) {
                                                          setTaxTypes(prev => ({...prev, [po.uniqueKey]: "VAT"}));
                                                      }
                                                  }}>
                                            <TableCell className="text-center">
                                                <Checkbox checked={selectedPoIds.includes(po.uniqueKey)}
                                                          onCheckedChange={(checked: boolean | "indeterminate") => {
                                                              if (checked === true) {
                                                                  setSelectedPoIds([...selectedPoIds, po.uniqueKey]);
                                                                  if (!taxTypes[po.uniqueKey]) setTaxTypes(prev => ({
                                                                      ...prev,
                                                                      [po.uniqueKey]: "VAT"
                                                                  }));
                                                              } else {
                                                                  setSelectedPoIds(selectedPoIds.filter(id => id !== po.uniqueKey));
                                                              }
                                                          }}/>
                                            </TableCell>
                                            <TableCell
                                                className="font-bold text-xs uppercase flex flex-col gap-1 text-foreground mt-1.5 border-none">
                                                <div className="flex items-center gap-1.5"><FileText
                                                    className="w-3 h-3 text-muted-foreground"/> {po.poNo}</div>
                                                <span
                                                    className="text-[9px] text-muted-foreground font-medium ml-4.5">{po.date ? format(new Date(po.date), "MMM dd, yyyy") : "No Date"}</span>
                                            </TableCell>
                                            <TableCell className="text-xs font-black text-primary uppercase">
                                                <div className="flex flex-col gap-1">
                                                    {po.receiptNo}
                                                    {po.type === 'CWO' && <Badge variant="outline"
                                                                                 className="w-fit text-[8px] bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Cash
                                                        With Order</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <select
                                                    className="h-7 w-full rounded-sm border border-input bg-background px-1 text-[10px] font-bold text-foreground shadow-sm disabled:opacity-30"
                                                    value={taxTypes[po.uniqueKey] || "VAT"}
                                                    onChange={(e) => setTaxTypes({
                                                        ...taxTypes,
                                                        [po.uniqueKey]: e.target.value as "VAT" | "NON_VAT"
                                                    })} disabled={!selectedPoIds.includes(po.uniqueKey)}>
                                                    <option value="VAT">VAT Registered</option>
                                                    <option value="NON_VAT">Non-Registered (No VAT)</option>
                                                </select>
                                            </TableCell>
                                            <TableCell
                                                className="text-xs font-black text-right text-emerald-600 dark:text-emerald-500">₱ {po.amountDue.toLocaleString('en-US', {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </StickyTableWrapper>

                    <DialogFooter className="mt-4 border-t border-border pt-4">
                        <Button variant="outline" onClick={() => setIsPoModalOpen(false)}
                                className="text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                        <Button onClick={handleImportPos} disabled={selectedPoIds.length === 0}
                                className="text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white">
                            Import {selectedPoIds.length} Record(s)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[700px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2 text-foreground">
                            <FileText className="w-5 h-5 text-purple-500"/>
                            Available Supplier Memos
                        </DialogTitle>
                        <DialogDescription
                            className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Select a Credit or Debit memo to apply to this voucher&apos;s payables.
                        </DialogDescription>
                    </DialogHeader>

                    <StickyTableWrapper className="max-h-[400px] overflow-auto border border-border rounded-md mt-4 custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                <TableRow className="border-border">
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Memo
                                        No</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type
                                        / Date</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GL
                                        Account & Reason</TableHead>
                                    <TableHead
                                        className="text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingMemos ? (
                                    <TableRow><TableCell colSpan={5}
                                                         className="h-24 text-center text-sm font-medium text-muted-foreground"><Loader2
                                        className="w-5 h-5 animate-spin mx-auto mb-2"/> Fetching
                                        Memos...</TableCell></TableRow>
                                ) : memos.length === 0 ? (
                                    <TableRow><TableCell colSpan={5}
                                                         className="h-24 text-center text-sm font-medium text-muted-foreground">No
                                        available memos found for this supplier.</TableCell></TableRow>
                                ) : (
                                    memos.map(memo => {
                                        const memoAvailableAmount = getMemoAvailableAmount(
                                            memo.remaining_amount ?? memo.amount,
                                            payables,
                                            memo.memo_number,
                                        );
                                        const requestedAmount = Number(
                                            memoAmounts[String(memo.id)] ?? memo.remaining_amount ?? memo.amount,
                                        );
                                        const memoAmountError = getMemoAmountError(requestedAmount, memoAvailableAmount);

                                        return (
                                        <TableRow key={memo.id} className="hover:bg-muted/50 border-border">
                                            <TableCell
                                                className="font-bold text-xs uppercase text-foreground">{memo.memo_number}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline"
                                                       className={`text-[9px] uppercase ${memo.type === 1 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-600 border-red-200 bg-red-50'}`}>
                                                    {memo.memo_type_name}
                                                </Badge>
                                                <div
                                                    className="text-[9px] text-muted-foreground mt-1 font-medium">{format(new Date(memo.date), "MMM dd, yyyy")}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div
                                                    className="text-[10px] font-black uppercase text-foreground">{memo.account_title}</div>
                                                <div
                                                    className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{memo.reason || "N/A"}</div>
                                            </TableCell>
                                            <TableCell
                                                className={`text-xs font-black text-right ${memo.type === 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                <div>{memo.type === 1 ? '-' : '+'} ₱{memo.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                                                <div className="text-[9px] font-bold text-muted-foreground">Remaining: ₱{(memo.remaining_amount ?? memo.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                                                <Input
                                                    type="number"
                                                    min="0.01"
                                                    max={memoAvailableAmount}
                                                    step="0.01"
                                                    value={memoAmounts[String(memo.id)] ?? String(memo.remaining_amount ?? memo.amount)}
                                                    onChange={(event) => setMemoAmounts((current) => ({ ...current, [String(memo.id)]: event.target.value }))}
                                                    aria-invalid={!!memoAmountError}
                                                    className={`h-7 w-28 ml-auto mt-1 text-right text-xs ${memoAmountError ? "border-destructive" : ""}`}
                                                />
                                                {memoAmountError && (
                                                    <p role="alert" className="mt-1 text-[10px] leading-tight text-destructive">
                                                        {memoAmountError}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleApplyMemo(memo)} disabled={!!memoAmountError}
                                                        className="h-7 text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white">
                                                    Apply
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </StickyTableWrapper>
                </DialogContent>
            </Dialog>
        </>
    );
}
