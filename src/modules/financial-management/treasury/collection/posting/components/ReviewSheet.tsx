import React, { useMemo } from "react";
import {
    Lock, Loader2, Wallet, Receipt, Calculator, User,
    Calendar, Briefcase, MapPin, MessageSquare, ShieldAlert, CheckCircle2,
    Banknote, Percent, Undo2, FileSignature, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export interface CashBucket {
    detailId?: number;
    tempId?: string;
    paymentMethodId?: number;
    coaId?: number;
    bankId?: number | null;
    customerCode?: string;
    invoiceId?: number;
    referenceNo?: string;
    amount?: number;
    chequeDate?: string | null;
    quantity?: number;
    findingId?: number;
    balanceTypeId?: number;
    resolvedType?: string;
}

export interface PouchAllocation {
    amountApplied?: number;
    allocationType?: string;
    customerName?: string;
    invoiceNo?: string;
    invoiceId?: string | number;
    referenceNo?: string;
}

export interface TreasuryPouch {
    id: number;
    docNo?: string;
    collectionDate?: string;
    salesmanName?: string;
    salesmanId?: string | number;
    operationName?: string;
    encoderName?: string;
    encoderId?: string | number;
    remarks?: string;
    cashBuckets?: CashBucket[];
    allocations?: PouchAllocation[];
}

interface ReviewSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    isLoading: boolean;
    pouch: TreasuryPouch | null;
    isPosting: boolean;
    onPost: (id: number, docNo: string, shortageAmount: number) => void;
}

export function ReviewSheet({ isOpen, onOpenChange, isLoading, pouch, isPosting, onPost }: ReviewSheetProps) {

    const reviewMath = useMemo(() => {
        if (!pouch) return { physical: 0, applied: 0, variance: 0, isShortage: false, isOverage: false, groupedAllocations: {} as Record<string, PouchAllocation[]>, totalCash: 0, totalChecks: 0, nonCashBuckets: [] as CashBucket[], cashDenominations: [] as CashBucket[] };

        let physical = 0;
        let totalCash = 0;
        let totalChecks = 0;
        const nonCashBuckets: CashBucket[] = [];
        const cashDenominations: CashBucket[] = [];

        pouch.cashBuckets?.forEach((b) => {
            const amt = Math.abs(b.amount || 0);
            const tempId = String(b.tempId || "").toLowerCase();
            const refNo = String(b.referenceNo || "").toLowerCase();

            // 🚀 COMPLETELY REMOVED THE ROGUE STRING. STRICT ID MATCHING ONLY.
            let typeLabel = "ADJUSTMENT";

            // 1. CASH (Method ID 1 or COA 1)
            const isCash = b.coaId === 1 || b.paymentMethodId === 1 || tempId.startsWith("cash") || refNo.includes(" x ") || refNo === "cash_summary" || refNo === "physical cash";

            if (isCash) {
                typeLabel = "CASH";
            }
            // 2. CHECK (Method ID 2)
            else if (tempId.startsWith("chk") || b.paymentMethodId === 2) {
                typeLabel = "CHECK";
            }
            // 3. EWT (Method ID 10)
            else if (tempId.startsWith("ewt") || b.paymentMethodId === 10) {
                typeLabel = "EWT";
            }
            // 4. OTHER METHODS
            else if (b.paymentMethodId != null) {
                typeLabel = `METHOD_${b.paymentMethodId}`;
            }

            const isCredit = b.balanceTypeId === 1;

            // APPLY TO GRAND PHYSICAL TOTAL
            if (isCredit) {
                physical -= amt;
            } else {
                physical += amt;
            }

            // MERGE OR SEPARATE BASED ON TYPE
            if (typeLabel === "CASH") {
                if (isCredit) totalCash -= amt;
                else totalCash += amt;

                // Push to hover tooltip breakdown (skip the summary row)
                if (refNo !== "cash_summary" && amt > 0) {
                    cashDenominations.push(b);
                }
            } else {
                // Non-cash items stay separated
                if (typeLabel === "CHECK" && !isCredit) totalChecks += amt;
                nonCashBuckets.push({ ...b, resolvedType: typeLabel });
            }
        });

        // Sort denominations highest to lowest
        cashDenominations.sort((a, b) => (b.amount || 0) - (a.amount || 0));

        let totalApplied = 0;
        let expectedPhysicalCash = 0;
        const groupedAllocations: Record<string, PouchAllocation[]> = {};

        pouch.allocations?.forEach((a) => {
            const amt = Math.abs(a.amountApplied || 0);
            totalApplied += amt;

            const typeStr = String(a.allocationType || "PAYMENT").toUpperCase();
            if (!typeStr.includes("EWT") && !typeStr.includes("TAX") && !typeStr.includes("MEMO") && !typeStr.includes("CM") && !typeStr.includes("DM") && !typeStr.includes("RETURN") && !typeStr.includes("RTN")) {
                expectedPhysicalCash += amt;
            }

            const customer = a.customerName || "Unknown Customer";
            if (!groupedAllocations[customer]) groupedAllocations[customer] = [];
            groupedAllocations[customer].push(a);
        });

        const variance = expectedPhysicalCash - physical;

        return {
            physical, totalCash, totalChecks, nonCashBuckets, cashDenominations,
            applied: totalApplied,
            variance: Math.abs(variance),
            isShortage: variance > 0.01,
            isOverage: variance < -0.01,
            groupedAllocations
        };
    }, [pouch]);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[800px] xl:max-w-[1000px] overflow-y-auto border-l-border shadow-2xl flex flex-col p-0">

                <SheetHeader className="sr-only">
                    <SheetTitle>Treasury Pouch Review</SheetTitle>
                    <SheetDescription>Detailed audit breakdown of the selected treasury pouch.</SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                        <Loader2 size={32} className="animate-spin text-primary/50" />
                        <p className="font-black uppercase tracking-widest text-xs">Extracting Complete Pouch Audit...</p>
                    </div>
                ) : pouch ? (
                    <>
                        <div className="bg-card border-b p-6 shrink-0 shadow-sm z-10 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-black font-mono text-primary flex items-center gap-3">
                                        {pouch.docNo}
                                        {reviewMath.isShortage && <Badge variant="destructive" className="bg-red-600 text-xs tracking-widest px-2.5 py-1 uppercase shadow-sm"><ShieldAlert size={14} className="mr-1.5"/> AUDIT PENDING</Badge>}
                                        {!reviewMath.isShortage && !reviewMath.isOverage && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs tracking-widest px-2.5 py-1 uppercase shadow-sm"><CheckCircle2 size={14} className="mr-1.5"/> BALANCED</Badge>}
                                    </h2>
                                    <p className="font-bold text-xs uppercase tracking-widest mt-1 text-muted-foreground">
                                        System Generated Treasury Review Document
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Collection Date</p>
                                    <Badge variant="outline" className="text-sm font-mono font-black py-1 px-3 bg-muted/50">
                                        <Calendar size={14} className="mr-2" />
                                        {pouch.collectionDate?.split('T')[0] || "N/A"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5 mb-1"><MapPin size={10}/> Route Owner</p>
                                    <p className="font-black text-sm uppercase text-foreground leading-tight">{pouch.salesmanName || pouch.salesmanId || "Unknown Route"}</p>
                                </div>
                                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5 mb-1"><Briefcase size={10}/> Operation Type</p>
                                    <p className="font-black text-sm uppercase text-foreground leading-tight">{pouch.operationName || "Unassigned Operation"}</p>
                                </div>
                                <div className="p-3 bg-muted/30 border border-border rounded-xl">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5 mb-1"><User size={10}/> Cashier / Encoder</p>
                                    <p className="font-black text-sm uppercase text-foreground leading-tight">{pouch.encoderName || pouch.encoderId || "System Admin"}</p>
                                </div>
                            </div>

                            {pouch.remarks && (
                                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl flex gap-3 items-start">
                                    <MessageSquare size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-amber-800 tracking-widest mb-0.5">Cashier Remarks</p>
                                        <p className="text-xs font-bold text-amber-900/80 italic">{pouch.remarks}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/10">

                            <div className={`p-6 rounded-xl border-2 shadow-md flex justify-between items-center ${reviewMath.isShortage ? 'bg-red-50/80 border-red-200' : (reviewMath.isOverage ? 'bg-orange-50/80 border-orange-200' : 'bg-emerald-50/80 border-emerald-200')}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 rounded-xl shadow-inner ${reviewMath.isShortage ? 'bg-red-100 text-red-600' : (reviewMath.isOverage ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')}`}>
                                        <Calculator size={28} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-black uppercase tracking-widest ${reviewMath.isShortage ? 'text-red-700' : (reviewMath.isOverage ? 'text-orange-700' : 'text-emerald-700')}`}>
                                            {reviewMath.isShortage ? "Detected Cash Shortage" : (reviewMath.isOverage ? "Detected Unallocated Overage" : "Pouch is Perfectly Balanced")}
                                        </span>
                                        <span className={`text-3xl font-black font-mono tracking-tight ${reviewMath.isShortage ? 'text-red-600' : (reviewMath.isOverage ? 'text-orange-600' : 'text-emerald-600')}`}>
                                            ₱{reviewMath.variance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                </div>
                                {reviewMath.isShortage && (
                                    <div className="text-[10px] font-bold text-red-700 bg-red-100/50 p-3 rounded-lg border border-red-200 max-w-[200px] leading-relaxed shadow-sm">
                                        <ShieldAlert size={14} className="mb-1 text-red-600" />
                                        Posting this pouch will immediately trigger a payroll deduction finding for <span className="uppercase">{pouch.salesmanName || "the route owner"}</span>.
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* SECTION 1: PHYSICAL FUNDS */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b-2 border-emerald-100 pb-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                            <Wallet size={16} /> 1. Declared Physical Assets
                                        </h4>
                                        <div className="text-[9px] font-bold text-muted-foreground uppercase flex gap-3 text-right">
                                            <span>Cash: <span className="text-foreground">₱{Math.abs(reviewMath.totalCash).toLocaleString(undefined, {minimumFractionDigits:2})}</span></span>
                                            <span>Checks: <span className="text-foreground">₱{reviewMath.totalChecks.toLocaleString(undefined, {minimumFractionDigits:2})}</span></span>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        {pouch.cashBuckets?.length === 0 && <p className="text-xs text-muted-foreground italic bg-card p-4 rounded-xl border border-dashed text-center font-bold">No assets declared in this pouch.</p>}

                                        {/* MERGED CASH ROW */}
                                        {reviewMath.totalCash !== 0 && (
                                            <div className={`relative group cursor-help flex justify-between items-center p-3.5 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-emerald-300 ${reviewMath.totalCash < 0 ? 'border-red-200' : 'border-border'}`}>

                                                {/* THE HOVER TOOLTIP */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-56 bg-popover border border-border shadow-2xl rounded-xl p-4 z-50 animate-in fade-in zoom-in-95">
                                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-8 border-transparent border-t-popover drop-shadow-sm"></div>
                                                    <h5 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest border-b border-border pb-1.5 mb-2.5">Denomination Breakdown</h5>
                                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                                                        {reviewMath.cashDenominations.length === 0 ? (
                                                            <p className="text-[10px] text-muted-foreground italic text-center">No breakdown saved.</p>
                                                        ) : reviewMath.cashDenominations.map((denom, idx) => {
                                                            const parts = denom.referenceNo?.split('x') || [];
                                                            const faceValue = parts[0]?.trim() || "Cash";
                                                            const qty = denom.quantity || parts[1]?.trim() || "?";
                                                            const isCred = denom.balanceTypeId === 1;

                                                            return (
                                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                                    <div className="flex gap-2 items-baseline">
                                                                        <span className={`font-bold ${isCred ? 'text-red-500' : 'text-foreground'}`}>{faceValue}</span>
                                                                        <span className="text-[9px] font-black text-muted-foreground/60">x{qty}</span>
                                                                    </div>
                                                                    <span className={`font-mono font-bold ${isCred ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {isCred ? "-" : ""}₱{Math.abs(denom.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-border">
                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">Net Cash</span>
                                                        <span className={`font-mono font-black text-sm ${reviewMath.totalCash < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {reviewMath.totalCash < 0 ? "-" : ""}₱{Math.abs(reviewMath.totalCash).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                                        Physical Cash (Merged) <Info size={12} className="text-muted-foreground opacity-50 ml-1" />
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 flex flex-wrap gap-2">
                                                        <span>Type: CASH</span>
                                                        <span>• Hover for Breakdown</span>
                                                    </span>
                                                </div>
                                                <span className={`font-mono font-black text-base ${reviewMath.totalCash < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {reviewMath.totalCash < 0 ? "-" : ""}₱{Math.abs(reviewMath.totalCash).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </span>
                                            </div>
                                        )}

                                        {/* NON-CASH BUCKETS */}
                                        {reviewMath.nonCashBuckets.map((b, i) => {
                                            const isCredit = b.balanceTypeId === 1;
                                            const typeLabel = b.resolvedType || "ADJUSTMENT";
                                            const isCheck = typeLabel === "CHECK";

                                            return (
                                                <div key={i} className={`flex justify-between items-center p-3.5 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${isCredit ? 'border-red-200' : 'border-border'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                                            {b.referenceNo || typeLabel}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 flex flex-wrap gap-2">
                                                            <span className={isCredit ? "text-red-600 font-black" : ""}>Type: {typeLabel}</span>
                                                            {isCheck && (
                                                                <>
                                                                    {b.bankId != null && <span>• Bank ID: <span className="text-foreground">{b.bankId}</span></span>}
                                                                    {b.referenceNo && <span>• Ref/Chk#: <span className="text-foreground">{b.referenceNo}</span></span>}
                                                                    {b.chequeDate && <span>• Date: <span className="text-foreground">{b.chequeDate.split('T')[0]}</span></span>}
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span className={`font-mono font-black text-base ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {isCredit ? "-" : ""}₱{Math.abs(b.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between items-center px-3 pt-3 border-t-2 border-border">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pouch Target:</span>
                                        <span className="font-mono font-black text-emerald-600 text-lg">₱{reviewMath.physical.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                </div>

                                {/* SECTION 2: AR ALLOCATIONS */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2 border-b-2 border-blue-100 pb-2">
                                        <Receipt size={16} /> 2. Settled AR Invoices
                                    </h4>
                                    <div className="space-y-3.5">
                                        {Object.keys(reviewMath.groupedAllocations).length === 0 && (
                                            <p className="text-xs text-muted-foreground italic bg-card p-4 rounded-xl border border-dashed text-center font-bold">No AR invoices were settled.</p>
                                        )}
                                        {Object.entries(reviewMath.groupedAllocations).map(([customerName, allocs]) => {
                                            const customerTotal = allocs.reduce((sum, a) => sum + Math.abs(a.amountApplied || 0), 0);
                                            return (
                                                <div key={customerName} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                                                    <div className="bg-blue-50/80 dark:bg-blue-950/20 px-4 py-2.5 border-b border-border flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase text-foreground flex items-center gap-2">
                                                            <User size={14} className="text-blue-600 shrink-0"/>
                                                            <span className="truncate max-w-[200px]" title={customerName}>{customerName}</span>
                                                        </span>
                                                        <span className="text-xs font-black font-mono text-blue-700">
                                                            ₱{customerTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="p-2 space-y-1 bg-muted/5">
                                                        {allocs.map((a, i) => {
                                                            const typeStr = (a.allocationType || "PAYMENT").toUpperCase();
                                                            let badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
                                                            let TypeIcon = Banknote;
                                                            let typeLabel = "Payment";

                                                            if (typeStr.includes("EWT") || typeStr.includes("TAX")) {
                                                                badgeColor = "bg-purple-100 text-purple-700 border-purple-200";
                                                                TypeIcon = Percent;
                                                                typeLabel = typeStr;
                                                            } else if (typeStr.includes("MEMO") || typeStr.includes("CM") || typeStr.includes("DM")) {
                                                                badgeColor = "bg-amber-100 text-amber-700 border-amber-200";
                                                                TypeIcon = FileSignature;
                                                                typeLabel = "Credit Memo";
                                                            } else if (typeStr.includes("RETURN") || typeStr.includes("RTN")) {
                                                                badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
                                                                TypeIcon = Undo2;
                                                                typeLabel = "Return";
                                                            } else {
                                                                typeLabel = typeStr;
                                                            }

                                                            return (
                                                                <div key={i} className="flex justify-between items-center px-3 py-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border">
                                                                    <div className="flex flex-col gap-1.5 items-start">
                                                                        <span className="text-[10px] font-black uppercase text-foreground tracking-wider leading-none">
                                                                            Invoice {a.invoiceNo || a.invoiceId}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge variant="outline" className={`h-4 px-1.5 text-[8px] font-black tracking-widest uppercase rounded-sm ${badgeColor}`}>
                                                                                <TypeIcon size={8} className="mr-1" /> {typeLabel}
                                                                            </Badge>
                                                                            {a.referenceNo && (
                                                                                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                                    Ref: {a.referenceNo}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-mono font-black text-sm text-foreground/80">
                                                                        ₱{Math.abs(a.amountApplied || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between items-center px-3 pt-3 border-t-2 border-border">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total AR Applied:</span>
                                        <span className="font-mono font-black text-blue-600 text-lg">₱{reviewMath.applied.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border-t p-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-10 flex gap-3">
                            <Button
                                onClick={() => onPost(pouch.id, pouch.docNo || "", reviewMath.isShortage ? reviewMath.variance : 0)}
                                disabled={isPosting || pouch.allocations?.length === 0}
                                className={`flex-1 h-14 font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-[0.99] ${reviewMath.isShortage ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary'}`}
                            >
                                {isPosting ? <Loader2 size={20} className="animate-spin mr-2" /> : <Lock size={20} className="mr-2" />}
                                Commit & Post to General Ledger
                            </Button>
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}