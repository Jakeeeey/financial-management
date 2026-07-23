"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Search, FileText, DownloadCloud } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    DisbursementPayload, PayableLine, PaymentLine, SupplierDto, COADto,
    Disbursement, BankAccountDto, UnpaidPoDto, MemoDto, DivisionDto, DepartmentDto
} from "../types";
import { disbursementProvider } from "../providers/fetchProvider";
import { toast } from "sonner";
import { AddPayeeModal } from "@/modules/financial-management/payee-registration/components/modals/add-payee-modal";
import type { Payee } from "@/modules/financial-management/payee-registration/types/payee.schema";
import { formatCurrency } from "../utils/disbursement-utils";
import { VoucherDetailsSection } from "./VoucherDetailsSection";
import { PayablesSection } from "./PayablesSection";
import { PaymentsSection } from "./PaymentsSection";
import { StickyTableWrapper } from "./StickyTableWrapper";

export interface ExtendedDisbursement extends Disbursement {
    payeeId?: number;
    divisionId?: number;
    departmentId?: number;
}

interface CashIssuanceCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: DisbursementPayload) => Promise<boolean>;
    loading: boolean;
    editData?: ExtendedDisbursement | null;
}
const isPaymentCOA = (c: COADto) => {
    return !!c.isPayment;
};

const isPayableOrExpenseCOA = (c: COADto) => !isPaymentCOA(c);

export function CashIssuanceCreateDialog({
    open,
    onOpenChange,
    onSubmit,
    loading,
    editData
}: CashIssuanceCreateDialogProps) {
    const today = new Date().toISOString().split("T")[0];

    const [transactionTypeId, setTransactionTypeId] = useState<number | "">(1);
    const [payeeId, setPayeeId] = useState<number | "">("");
    const [remarks, setRemarks] = useState("");
    const [transactionDate, setTransactionDate] = useState(today);

    const [payables, setPayables] = useState<PayableLine[]>([]);
    const [payments, setPayments] = useState<PaymentLine[]>([]);

    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [banks, setBanks] = useState<BankAccountDto[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const [unpaidPos, setUnpaidPos] = useState<UnpaidPoDto[]>([]);
    const [loadingPos, setLoadingPos] = useState(false);
    const [isPoModalOpen, setIsPoModalOpen] = useState(false);
    const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
    const [taxTypes, setTaxTypes] = useState<Record<string, "VAT" | "NON_VAT">>({});

    const [memos, setMemos] = useState<MemoDto[]>([]);
    const [memoAmounts, setMemoAmounts] = useState<Record<string, string>>({});
    const [loadingMemos, setLoadingMemos] = useState(false);
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

    const [divisionId, setDivisionId] = useState<number | "">("");
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [supportingDocumentsUrl, setSupportingDocumentsUrl] = useState("");
    const [uploadingFile, setUploadingFile] = useState(false);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    const [poSearchQuery, setPoSearchQuery] = useState("");
    const [isPayeeRegistrationOpen, setIsPayeeRegistrationOpen] = useState(false);
    
    const [previewDocNo, setPreviewDocNo] = useState("");
    const [loadingDocNo, setLoadingDocNo] = useState(false);

    const isReleasingEdit = !!(editData && editData.status === "Approved");
    const isReadOnly = !!(editData && (
        editData.status === "Released" || 
        editData.status === "Posted" || 
        (editData.status === "Submitted" && !editData.transactionTypeName?.toUpperCase().includes("NON"))
    ));

    const isHeaderLocked = isReleasingEdit || isReadOnly;
    const isPayablesLocked = isReleasingEdit || isReadOnly;
    const isPaymentsLocked = isReadOnly;

    const totalAmount = useMemo(() => payables.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [payables]);
    const totalPayments = useMemo(() => payments.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [payments]);
    const paymentDifference = useMemo(() => totalAmount - totalPayments, [totalAmount, totalPayments]);

    const isNonTradeVoucher = transactionTypeId === 2;
    const payeeSupplierType = isNonTradeVoucher ? "NON-TRADE" : "TRADE";
    const payeeSupplierTypeLabel = isNonTradeVoucher ? "Non-Trade" : "Trade";

    useEffect(() => {
        if (open) {
            disbursementProvider.getCOAs().then(res => setCoas(Array.isArray(res) ? res : []));
            disbursementProvider.getBanks().then(res => setBanks(Array.isArray(res) ? res : []));
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
                setDivisionId(editData.divisionId != null ? Number(editData.divisionId) : "");
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
                    coaId: p.coaId,
                    divisionId: p.divisionId || undefined,
                    remarks: p.remarks,
                    accountTitle: p.accountTitle
                })));

                setPayments(editData.payments.map(p => ({
                    id: p.id,
                    checkNo: p.checkNo || "",
                    date: p.date ? p.date.split('T')[0] : today,
                    amount: p.amount,
                    coaId: p.coaId,
                    bankId: p.bankId,
                    remarks: p.remarks,
                    accountTitle: p.accountTitle
                })));
            } else {
                setTransactionTypeId(1);
                setPayeeId("");
                setDivisionId("");
                setDepartmentId("");
                setRemarks("");
                setSupportingDocumentsUrl("");
                // Start with one blank row for payables so the user can begin typing immediately, payments start empty
                setPayables([{referenceNo: "", date: today, amount: 0, remarks: "", divisionId: undefined}]);
                setPayments([]);
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
        if (open && editData && !divisionId && editData.divisionName && divisions.length > 0) {
            const match = divisions.find(d => d.divisionName?.toLowerCase() === editData.divisionName?.toLowerCase());
            if (match) setDivisionId(match.divisionId);
        }
    }, [open, editData, divisionId, divisions]);

    useEffect(() => {
        if (open && editData && !departmentId && editData.departmentName && departments.length > 0) {
            const match = departments.find(d => d.departmentName?.toLowerCase() === editData.departmentName?.toLowerCase());
            if (match) setDepartmentId(match.departmentId);
        }
    }, [open, editData, departmentId, departments]);

    const handleAddPayable = useCallback(() => setPayables((prev) => [...prev, {referenceNo: "", date: today, amount: 0, remarks: "", divisionId: divisionId || undefined}]), [today, divisionId]);

    // Pre-fill payment amount with the outstanding balance; auto-select COA if only one payment option exists
    const handleAddPayment = useCallback(() => {
        const remaining = Number((totalAmount - totalPayments).toFixed(2));
        const paymentCoas = coas.filter(isPaymentCOA);
        const autoCoaId = paymentCoas.length === 1 ? paymentCoas[0].coaId : undefined;
        setPayments((prev) => [...prev, {
            checkNo: "",
            date: today,
            amount: remaining > 0 ? remaining : 0,
            remarks: "",
            coaId: autoCoaId,
        }]);
    }, [totalAmount, totalPayments, coas, today]);

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

    // Auto-open PO modal when a Trade payee is selected (no extra click needed)
    const handlePayeeSelect = useCallback((val: number) => {
        setPayeeId(val);
        if (!isNonTradeVoucher && val) {
            handleOpenPoModal(val);
        }
    }, [isNonTradeVoucher, handleOpenPoModal]);

    const calculateTaxedPayables = useCallback((selectedPos: UnpaidPoDto[], currentTaxTypes: Record<string, "VAT" | "NON_VAT">, date: string): PayableLine[] => {
        const newPayables: PayableLine[] = [];
        const VAT_RATE = 0.12;
        const EWT_RATE = 0.01;

        selectedPos.forEach(po => {
            const baseRef = `${po.poNo} / ${po.receiptNo}`;
            const taxType = currentTaxTypes[po.uniqueKey] || "VAT";
            const currentDivId = divisionId || undefined;

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
                    divisionId: currentDivId
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(vatAmount.toFixed(2)),
                    coaId: 9,
                    remarks: `Input VAT (12%)`,
                    divisionId: currentDivId
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: -Number(ewtAmount.toFixed(2)),
                    coaId: 38,
                    remarks: `EWT Deduction (1%)`,
                    divisionId: currentDivId
                });
            } else {
                newPayables.push({
                    referenceNo: baseRef,
                    date: date,
                    amount: Number(po.amountDue.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal (Non-VAT)`,
                    divisionId: currentDivId
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
        const requestedAmount = Number(memoAmounts[String(memo.id)] ?? remainingAmount);
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > remainingAmount + 0.01) {
            return toast.error(`Memo ${memo.memo_number} can only use up to ${remainingAmount.toFixed(2)}.`);
        }
        const finalAmount = isCredit ? -Math.abs(requestedAmount) : Math.abs(requestedAmount);

        setPayables([...payables, {
            referenceNo: memo.memo_number,
            date: today,
            amount: finalAmount,
            coaId: memo.coa_id,
            remarks: `${memo.memo_type_name}: ${memo.reason || 'Applied to voucher'}`
        }]);

        setIsMemoModalOpen(false);
        toast.success(`${memo.memo_type_name} applied successfully!`);
    };

    const handleSubmit = async () => {
        if (!transactionTypeId) return toast.error("Transaction Type is required.");
        if (!payeeId) return toast.error("Please select a Payee.");
        if (!divisionId) return toast.error("Division is required.");
        if (!departmentId) return toast.error("Department is required.");
        if (totalAmount <= 0) return toast.error("Voucher total must be greater than 0.");

        const invalidPaymentCoa = payments.some(p => p.coaId == null);
        if (invalidPaymentCoa) {
            return toast.error("All payment lines must have a valid GL Account (COA) selected.");
        }

        const payload: DisbursementPayload = {
            docNo: editData ? editData.docNo : undefined,
            transactionTypeId: Number(transactionTypeId),
            payeeId: Number(payeeId),
            divisionId: Number(divisionId),
            departmentId: Number(departmentId),
            remarks,
            supportingDocumentsUrl: supportingDocumentsUrl ? (supportingDocumentsUrl.includes("/") ? (supportingDocumentsUrl.split("/").pop()?.split("?")[0] || "") : supportingDocumentsUrl) : "",
            totalAmount: totalAmount,
            transactionDate,
            payables: payables.map(p => ({
                ...p,
                coaId: p.coaId ? Number(p.coaId) : undefined,
                divisionId: p.divisionId ? Number(p.divisionId) : undefined
            })),
            payments: payments.map(p => ({
                ...p,
                coaId: p.coaId ? Number(p.coaId) : undefined,
                bankId: p.bankId ? Number(p.bankId) : undefined
            })),
        };
        const success = await onSubmit(payload);
        if (success) {
            setTransactionTypeId(1);
            setPayeeId("");
            setDivisionId("");
            setDepartmentId("");
            setRemarks("");
            setSupportingDocumentsUrl("");
            setPayables([]);
            setPayments([]);
            onOpenChange(false);
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
                            <div className="flex flex-col items-end border-l border-border pl-6">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Paid</span>
                                <span className="font-bold text-foreground">{formatCurrency(totalPayments)}</span>
                            </div>
                            <div className="flex flex-col items-end border-l border-border pl-6">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Difference</span>
                                <span className={cn("font-bold flex items-center gap-1", paymentDifference === 0 ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500")}>
                                    {formatCurrency(paymentDifference)}
                                    {paymentDifference === 0 && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1 rounded-sm border border-emerald-200">Balanced</span>
                                    )}
                                </span>
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
                                    divisions={divisions}
                                    divisionId={divisionId}
                                    setDivisionId={setDivisionId}
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
                                    totalPayments={totalPayments}
                                    paymentDifference={paymentDifference}
                                    disabled={isHeaderLocked}
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Table line items */}
                        <div className="md:col-span-8 flex flex-col h-full overflow-y-auto scrollbar-thin bg-background">
                            <div className="p-6 space-y-6">
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
                                    formatMoney={formatCurrency}
                                    disabled={isPayablesLocked}
                                    isAddDisabled={!divisionId || !departmentId}
                                />

                                <PaymentsSection
                                    payments={payments}
                                    setPayments={setPayments}
                                    bankAccounts={banks}
                                    coas={coas}
                                    handleAddPayment={handleAddPayment}
                                    handleRemovePayment={(idx) => setPayments(payments.filter((_, i) => i !== idx))}
                                    totalPayments={totalPayments}
                                    formatMoney={formatCurrency}
                                    disabled={isPaymentsLocked}
                                    isAddDisabled={!divisionId || !departmentId}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted border-t border-border shrink-0 flex justify-between items-center z-10">
                        <div
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            Lines: {payables.length} Allocated | {payments.length} Paid
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}
                                    className="border-input text-foreground hover:bg-accent font-bold text-xs h-9 px-5 rounded-sm">Cancel</Button>
                            <Button onClick={handleSubmit} disabled={loading || isReadOnly}
                                    className="text-xs font-bold h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm shadow-sm transition-colors">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> :
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

            <Dialog open={isPoModalOpen} onOpenChange={setIsPoModalOpen}>
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
                                    memos.map(memo => (
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
                                                    max={memo.remaining_amount ?? memo.amount}
                                                    step="0.01"
                                                    value={memoAmounts[String(memo.id)] ?? String(memo.remaining_amount ?? memo.amount)}
                                                    onChange={(event) => setMemoAmounts((current) => ({ ...current, [String(memo.id)]: event.target.value }))}
                                                    className="h-7 w-28 ml-auto mt-1 text-right text-xs"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleApplyMemo(memo)}
                                                        className="h-7 text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white">
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
        </>
    );
}
