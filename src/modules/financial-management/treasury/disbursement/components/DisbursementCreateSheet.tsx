"use client";

import React, {useState, useEffect} from "react";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Checkbox} from "@/components/ui/checkbox";
import {Badge} from "@/components/ui/badge";
import {
    Plus, Trash2, Loader2, Save, Building2, Wallet, Calculator,
    DownloadCloud, FileText, Check, ChevronsUpDown, Search
} from "lucide-react";
import {format} from "date-fns";
import {cn} from "@/lib/utils";
import {
    DisbursementPayload, PayableLine, PaymentLine, SupplierDto, COADto,
    Disbursement, BankAccountDto, UnpaidPoDto, MemoDto, DivisionDto, DepartmentDto
} from "../types";
import {disbursementProvider} from "../providers/fetchProvider";
import {toast} from "sonner";

interface DisbursementCreateSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: DisbursementPayload) => Promise<boolean>;
    loading: boolean;
    editData?: Disbursement | null;
}

function SearchableDropdown({options, value, onSelect, placeholder, disabled, className, popoverWidth = "w-[400px]"}: {
    options: { label: string; value: number | string }[];
    value: number | string;
    onSelect: (val: number | string) => void;
    placeholder: string;
    disabled?: boolean;
    className?: string;
    popoverWidth?: string;
}) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
                        className={cn("justify-between font-normal px-3", className)}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("p-0 shadow-lg border-border", popoverWidth)} align="start">
                <Command>
                    <CommandInput placeholder="Search..." className="h-9 text-xs"/>
                    <CommandList className="max-h-[250px] scrollbar-thin">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No results
                            found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem key={opt.value} value={opt.label} onSelect={() => {
                                    onSelect(opt.value);
                                    setOpen(false);
                                }} className="text-xs cursor-pointer">
                                    <Check
                                        className={cn("mr-2 h-4 w-4 text-primary", value === opt.value ? "opacity-100" : "opacity-0")}/>
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

export function DisbursementCreateSheet({
                                            open,
                                            onOpenChange,
                                            onSubmit,
                                            loading,
                                            editData
                                        }: DisbursementCreateSheetProps) {
    const today = new Date().toISOString().split("T")[0];

    // 🚀 FIX: Removed the unused setVoucherType to silence ESLint
    const [voucherType] = useState("Trade");

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
    const [loadingMemos, setLoadingMemos] = useState(false);
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

    const [divisionId, setDivisionId] = useState<number | "">("");
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    const [poSearchQuery, setPoSearchQuery] = useState("");

    const totalAmount = payables.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

    useEffect(() => {
        if (open) {
            setLoadingData(true);
            Promise.all([
                disbursementProvider.getSuppliers(voucherType).then(setSuppliers),
                disbursementProvider.getCOAs().then(setCoas),
                disbursementProvider.getBanks().then(setBanks),
                disbursementProvider.getDivisions().then(setDivisions).catch(() => console.warn("No divisions route yet")),
                disbursementProvider.getDepartments().then(setDepartments).catch(() => console.warn("No departments route yet"))
            ]).finally(() => setLoadingData(false));

            if (editData) {
                setPayeeId(editData.payeeId || "");
                setDivisionId(editData.divisionId || "");
                setDepartmentId(editData.departmentId || "");
                setRemarks(editData.remarks || "");
                setTransactionDate(editData.transactionDate ? editData.transactionDate.split('T')[0] : today);
                setPayables(editData.payables.map(p => ({
                    id: p.id,
                    referenceNo: p.referenceNo || "",
                    date: p.date ? p.date.split('T')[0] : today,
                    amount: p.amount,
                    coaId: p.coaId,
                    divisionId: p.divisionId || undefined,
                    remarks: p.remarks
                })));
                setPayments(editData.payments.map(p => ({
                    id: p.id,
                    checkNo: p.checkNo || "",
                    date: p.date ? p.date.split('T')[0] : today,
                    amount: p.amount,
                    coaId: p.coaId,
                    bankId: p.bankId,
                    remarks: p.remarks
                })));
            } else {
                setPayeeId("");
                setDivisionId("");
                setDepartmentId("");
                setRemarks("");
                setPayables([]);
                setPayments([]);
                setTransactionDate(today);
            }
        }
    }, [voucherType, open, editData, today]);

    const handleAddPayable = () => setPayables([...payables, {referenceNo: "", date: today, amount: 0, remarks: ""}]);
    const handleAddPayment = () => setPayments([...payments, {checkNo: "", date: today, amount: 0, remarks: ""}]);

    const handleOpenPoModal = async () => {
        if (!payeeId) return toast.error("Please select a Payee first.");
        setLoadingPos(true);
        setIsPoModalOpen(true);
        try {
            const pos = await disbursementProvider.getUnpaidPos(Number(payeeId));
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
    };

    const handleImportPos = () => {
        const selected = unpaidPos.filter(po => selectedPoIds.includes(po.uniqueKey));
        const newPayables: PayableLine[] = [];
        const VAT_RATE = 0.12;
        const EWT_RATE = 0.01;

        selected.forEach(po => {
            const baseRef = `${po.poNo} / ${po.receiptNo}`;
            const taxType = taxTypes[po.uniqueKey] || "VAT";

            if (taxType === "VAT") {
                const netAmount = po.amountDue / (1 + VAT_RATE);
                const vatAmount = netAmount * VAT_RATE;
                const ewtAmount = netAmount * EWT_RATE;
                newPayables.push({
                    referenceNo: baseRef,
                    date: today,
                    amount: Number(netAmount.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal Net of VAT`
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: today,
                    amount: Number(vatAmount.toFixed(2)),
                    coaId: 9,
                    remarks: `Input VAT (12%)`
                });
                newPayables.push({
                    referenceNo: baseRef,
                    date: today,
                    amount: -Number(ewtAmount.toFixed(2)),
                    coaId: 38,
                    remarks: `EWT Deduction (1%)`
                });
            } else {
                newPayables.push({
                    referenceNo: baseRef,
                    date: today,
                    amount: Number(po.amountDue.toFixed(2)),
                    coaId: 8,
                    remarks: `Principal (Non-VAT)`
                });
            }
        });

        setPayables([...payables, ...newPayables]);
        setIsPoModalOpen(false);
        toast.success(`Imported ${selected.length} record(s) successfully`);
    };

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
            remarks: `${memo.memo_type_name}: ${memo.reason || 'Applied to voucher'}`
        }]);

        setIsMemoModalOpen(false);
        toast.success(`${memo.memo_type_name} applied successfully!`);
    };

    const handleSubmit = async () => {
        if (!payeeId) return toast.error("Please select a Payee.");
        if (!divisionId) return toast.error("Division is required.");
        if (!departmentId) return toast.error("Department is required.");
        if (totalAmount <= 0) return toast.error("Voucher total must be greater than 0.");

        const payload: DisbursementPayload = {
            docNo: editData ? editData.docNo : "",
            payeeId: Number(payeeId),
            divisionId: Number(divisionId),
            departmentId: Number(departmentId),
            remarks,
            totalAmount: totalAmount,
            transactionDate,
            payables: payables.map(p => ({
                ...p,
                coaId: Number(p.coaId) || undefined,
                divisionId: Number(p.divisionId) || undefined
            })),
            payments: payments.map(p => ({
                ...p,
                coaId: Number(p.coaId) || undefined,
                bankId: Number(p.bankId) || undefined
            })),
        };
        const success = await onSubmit(payload);
        if (success) {
            setPayeeId("");
            setDivisionId("");
            setDepartmentId("");
            setRemarks("");
            setPayables([]);
            setPayments([]);
            onOpenChange(false);
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    className="sm:max-w-[950px] w-full p-0 flex flex-col bg-background overflow-hidden border-l border-border">
                    <SheetHeader className="p-6 border-b border-border bg-card shrink-0">
                        <SheetTitle
                            className="text-xl font-black uppercase text-foreground">{editData ? `Edit Draft: ${editData.docNo}` : "New Disbursement Voucher"}</SheetTitle>
                        <SheetDescription
                            className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{editData ? "Update voucher details and line items." : "Draft a new voucher, select a payee, and assign financial entries."}</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
                        <div className="bg-card p-5 rounded-xl border border-border shadow-sm grid grid-cols-2 gap-4">
                            <div className="col-span-2 flex items-center gap-2 mb-2">
                                <Building2 className="w-4 h-4 text-primary"/>
                                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Voucher
                                    Details</h3>
                            </div>
                            <div className="space-y-1.5">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document
                                    No.</Label>
                                <Input value={editData ? editData.docNo : "AUTO-GENERATED BY SYSTEM"} disabled
                                       className="h-9 text-[10px] font-black text-muted-foreground uppercase border-border bg-muted"/>
                            </div>
                            <div className="space-y-1.5">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction
                                    Date <span className="text-destructive">*</span></Label>
                                <Input type="date" value={transactionDate}
                                       onChange={e => setTransactionDate(e.target.value)}
                                       className="h-9 text-xs font-bold uppercase border-input bg-background text-foreground"/>
                            </div>

                            <div className="space-y-1.5 col-span-2">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                                    Payee (Supplier) <span className="text-destructive">*</span>
                                    {loadingData && <Loader2 className="w-3 h-3 animate-spin text-primary"/>}
                                </Label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <SearchableDropdown
                                            options={suppliers.map(s => ({value: s.id, label: s.supplier_name}))}
                                            value={payeeId} onSelect={(val) => setPayeeId(Number(val))}
                                            placeholder={`-- Search ${voucherType} Payee --`}
                                            disabled={loadingData}
                                            className="h-9 w-full bg-background border-input text-xs font-bold uppercase"
                                        />
                                    </div>
                                    <Button type="button" onClick={handleOpenPoModal} disabled={!payeeId}
                                            className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shrink-0"
                                            title="Pull Unpaid POs">
                                        <DownloadCloud className="w-4 h-4"/>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Division <span
                                    className="text-destructive">*</span></Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold uppercase text-foreground shadow-sm focus-visible:outline-none"
                                    value={divisionId} onChange={e => setDivisionId(Number(e.target.value))}>
                                    <option value="" disabled>-- Select Division --</option>
                                    {/* 🚀 FIX: Used strict intersection type instead of any */}
                                    {divisions.map((d, index) => <option key={`main-div-${d.id || index}`}
                                                                         value={d.id || (d as DivisionDto & {divisionId?: number}).divisionId}>{d.divisionName}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Department <span
                                    className="text-destructive">*</span></Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold uppercase text-foreground shadow-sm focus-visible:outline-none"
                                    value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))}>
                                    <option value="" disabled>-- Select Department --</option>
                                    {/* 🚀 FIX: Used strict intersection type instead of any */}
                                    {departments.map((d, index) => <option key={`main-dept-${d.id || index}`}
                                                                           value={d.id || (d as DepartmentDto & {departmentId?: number}).departmentId}>{d.departmentName}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5 col-span-2">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Particulars
                                    / Remarks</Label>
                                <Input value={remarks} onChange={e => setRemarks(e.target.value)}
                                       className="h-9 text-xs border-input bg-background text-foreground"
                                       placeholder="What is this payment for?"/>
                            </div>

                            <div className="space-y-1.5 col-span-2 pt-2 border-t border-border mt-2">
                                <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                                    Total Voucher Amount <span
                                    className="text-emerald-600 dark:text-emerald-500 font-medium flex items-center gap-1"><Calculator
                                    className="w-3 h-3"/> Auto-Calculated</span>
                                </Label>
                                <div className="relative">
                                    <span
                                        className="absolute left-3 top-2.5 text-xs font-black text-muted-foreground">₱</span>
                                    <Input type="number" value={totalAmount.toFixed(2)} readOnly
                                           className="h-10 pl-7 text-sm font-black text-emerald-600 dark:text-emerald-500 border-border bg-muted cursor-not-allowed shadow-inner"
                                           placeholder="0.00"/>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card p-1 rounded-xl border border-border shadow-sm">
                            <Tabs defaultValue="payables" className="w-full">
                                <div className="px-4 pt-4 pb-2 border-b border-border">
                                    <TabsList className="grid w-full grid-cols-2 h-10 bg-muted">
                                        <TabsTrigger value="payables"
                                                     className="text-[10px] font-black uppercase tracking-widest">Payables
                                            (Expense)</TabsTrigger>
                                        <TabsTrigger value="payments"
                                                     className="text-[10px] font-black uppercase tracking-widest">Payments
                                            (Checks)</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="payables" className="p-4 m-0 space-y-4">
                                    <div className="rounded-md border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow className="border-border">
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ref
                                                        No (PO)</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground min-w-[200px]">Chart
                                                        of Account</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground min-w-[130px]">Division</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground min-w-[180px]">Remarks</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[120px]">Amount</TableHead>
                                                    <TableHead className="w-[40px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payables.length === 0 ? (
                                                    <TableRow><TableCell colSpan={6}
                                                                         className="text-center text-xs text-muted-foreground py-8 font-medium">No
                                                        payables added.</TableCell></TableRow>
                                                ) : payables.map((p, i) => (
                                                    <TableRow key={i} className="border-border hover:bg-muted/50">
                                                        <TableCell className="p-2 align-top pt-3">
                                                            <Input className="h-8 text-xs uppercase bg-background"
                                                                   placeholder="Invoice/PO" value={p.referenceNo}
                                                                   onChange={e => {
                                                                       const n = [...payables];
                                                                       n[i].referenceNo = e.target.value;
                                                                       setPayables(n);
                                                                   }}/>
                                                        </TableCell>
                                                        <TableCell className="p-2 align-top pt-3">
                                                            <SearchableDropdown
                                                                options={coas.map(c => ({
                                                                    value: c.coaId || 0,
                                                                    label: `${c.glCode || 'NO-CODE'} - ${c.accountTitle}`
                                                                }))}
                                                                value={p.coaId || ""} onSelect={(val) => {
                                                                const n = [...payables];
                                                                n[i].coaId = Number(val);
                                                                setPayables(n);
                                                            }}
                                                                placeholder="Search GL..."
                                                                className="h-8 w-full bg-background border-input text-[11px] font-medium"
                                                                popoverWidth="w-[350px]"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2 align-top pt-3">
                                                            <select
                                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-[10px] font-bold uppercase text-foreground shadow-sm"
                                                                value={p.divisionId || ""} onChange={e => {
                                                                const n = [...payables];
                                                                n[i].divisionId = Number(e.target.value);
                                                                setPayables(n);
                                                            }}>
                                                                <option value="" disabled>Division</option>
                                                                {/* 🚀 FIX: Used strict intersection type instead of any */}
                                                                {divisions.map((d, index) => <option
                                                                    key={`line-div-${i}-${d.id || index}`}
                                                                    value={d.id || (d as DivisionDto & {divisionId?: number}).divisionId}>{d.divisionName}</option>)}
                                                            </select>
                                                        </TableCell>
                                                        <TableCell className="p-2 align-top pt-3">
                                                            <Input className="h-8 text-[10px] bg-background"
                                                                   placeholder="Line remarks..." value={p.remarks || ""}
                                                                   onChange={e => {
                                                                       const n = [...payables];
                                                                       n[i].remarks = e.target.value;
                                                                       setPayables(n);
                                                                   }}/>
                                                        </TableCell>
                                                        <TableCell className="p-2 align-top pt-3">
                                                            <Input type="number"
                                                                   className={`h-8 text-xs font-bold bg-background ${p.amount < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-500'}`}
                                                                   value={p.amount || ""} onChange={e => {
                                                                const n = [...payables];
                                                                n[i].amount = Number(e.target.value);
                                                                setPayables(n);
                                                            }}/>
                                                        </TableCell>
                                                        <TableCell className="p-2 text-right align-top pt-3">
                                                            <Button variant="ghost" size="icon"
                                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => setPayables(payables.filter((_, idx) => idx !== i))}><Trash2
                                                                className="w-4 h-4"/></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <Button variant="outline" size="sm"
                                                className="flex-1 text-[10px] font-bold uppercase tracking-widest border-dashed text-primary hover:bg-primary/5 border-border"
                                                onClick={handleAddPayable}>
                                            <Plus className="w-3.5 h-3.5 mr-2"/> Add Manual Payable
                                        </Button>
                                        <Button variant="outline" size="sm"
                                                className="flex-1 text-[10px] font-bold uppercase tracking-widest border-dashed text-purple-600 hover:bg-purple-50 hover:text-purple-700 border-purple-200 dark:border-purple-800/50 dark:hover:bg-purple-900/20"
                                                onClick={handleOpenMemoModal}>
                                            <FileText className="w-3.5 h-3.5 mr-2"/> Apply Credit/Debit Memo
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="payments" className="p-4 m-0 space-y-4">
                                    <div className="rounded-md border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow className="border-border">
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Check
                                                        No / Ref</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[350px]">Bank
                                                        Account & GL Code</TableHead>
                                                    <TableHead
                                                        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[150px]">Amount</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payments.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4}
                                                                         className="text-center text-xs text-muted-foreground py-8 font-medium">No
                                                        payments added.</TableCell></TableRow>
                                                ) : payments.map((p, i) => (
                                                    <TableRow key={i} className="border-border hover:bg-muted/50">
                                                        <TableCell className="p-2 align-top pt-3"><Input
                                                            className="h-8 text-xs uppercase bg-background"
                                                            placeholder="e.g. CHK-123" value={p.checkNo}
                                                            onChange={e => {
                                                                const n = [...payments];
                                                                n[i].checkNo = e.target.value;
                                                                setPayments(n);
                                                            }}/></TableCell>
                                                        <TableCell className="p-2 align-top">
                                                            <div className="flex flex-col gap-2 pt-3">
                                                                <SearchableDropdown
                                                                    options={banks.map(b => ({
                                                                        value: b.bankId,
                                                                        label: `${b.bankName} - ${b.accountNumber}`
                                                                    }))}
                                                                    value={p.bankId || ""} onSelect={(val) => {
                                                                    const n = [...payments];
                                                                    n[i].bankId = Number(val);
                                                                    setPayments(n);
                                                                }}
                                                                    placeholder="Search Bank Account..."
                                                                    className="h-8 w-full border-primary/20 bg-primary/5 text-[11px] font-bold text-foreground"
                                                                    popoverWidth="w-[350px]"
                                                                />
                                                                <SearchableDropdown
                                                                    options={coas.filter(c => c.isPayment || c.isPaymentDuplicate).map(c => ({
                                                                        value: c.coaId || 0,
                                                                        label: `${c.glCode || 'NO-CODE'} - ${c.accountTitle}`
                                                                    }))}
                                                                    value={p.coaId || ""} onSelect={(val) => {
                                                                    const n = [...payments];
                                                                    n[i].coaId = Number(val);
                                                                    setPayments(n);
                                                                }}
                                                                    placeholder="Search General Ledger Code..."
                                                                    className="h-8 w-full bg-background border-input text-[11px] font-medium"
                                                                    popoverWidth="w-[450px]"
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-2 align-top pt-3"><Input type="number"
                                                                                                         className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-500 bg-background"
                                                                                                         value={p.amount || ""}
                                                                                                         onChange={e => {
                                                                                                             const n = [...payments];
                                                                                                             n[i].amount = Number(e.target.value);
                                                                                                             setPayments(n);
                                                                                                         }}/></TableCell>
                                                        <TableCell className="p-2 text-right align-top pt-3"><Button
                                                            variant="ghost" size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            onClick={() => setPayments(payments.filter((_, idx) => idx !== i))}><Trash2
                                                            className="w-4 h-4"/></Button></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <Button variant="outline" size="sm"
                                            className="w-full text-[10px] font-bold uppercase tracking-widest border-dashed text-primary hover:bg-primary/5 border-border"
                                            onClick={handleAddPayment}>
                                        <Plus className="w-3.5 h-3.5 mr-2"/> Add Payment Line
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                        <div
                            className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                            <Wallet className="w-4 h-4"/> Lines: {payables.length} Pay | {payments.length} Rcv
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}
                                    className="text-[10px] font-black uppercase tracking-widest h-10 px-6">Cancel</Button>
                            <Button onClick={handleSubmit} disabled={loading}
                                    className="text-[10px] font-black uppercase tracking-widest h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> :
                                    <Save className="w-4 h-4 mr-2"/>}
                                {editData ? "Update Voucher" : "Save Voucher"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

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

                    <div className="max-h-[350px] overflow-y-auto border border-border rounded-md mt-2">
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
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
                                                          onCheckedChange={(checked) => {
                                                              if (checked) {
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
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    className="h-7 w-full rounded-sm border border-input bg-background px-1 text-[10px] font-bold text-foreground shadow-sm disabled:opacity-30"
                                                    value={taxTypes[po.uniqueKey] || "VAT"}
                                                    onChange={(e) => setTaxTypes({
                                                        ...taxTypes,
                                                        [po.uniqueKey]: e.target.value as "VAT" | "NON_VAT"
                                                    })}
                                                    disabled={!selectedPoIds.includes(po.uniqueKey)}>
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
                    </div>

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

            {/* 🚀 MEMO MODAL */}
            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[700px] bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2 text-foreground">
                            <FileText className="w-5 h-5 text-purple-500"/>
                            Available Supplier Memos
                        </DialogTitle>
                        <DialogDescription
                            className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {/* 🚀 FIX: Escaped the apostrophe */}
                            Select a Credit or Debit memo to apply to this voucher&apos;s payables.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[400px] overflow-y-auto border border-border rounded-md mt-4">
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
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
                                                {memo.type === 1 ? '-' : '+'} ₱{memo.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}