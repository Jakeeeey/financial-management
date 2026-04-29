"use client";

import {useState, useEffect, useCallback} from "react";
import {UnpaidInvoice, SettlementAllocation, PaymentHistory} from "../../types";
import {fetchProvider} from "../../providers/fetchProvider";
import {toast} from "sonner";

export interface RawCashBucket {
    detailId?: number;
    findingId?: number;
    amount?: number;
    paymentMethodId?: number;
    coaId?: number;
    balanceTypeId?: number;
    referenceNo?: string;
    bankName?: string;
    checkNo?: string;
    checkDate?: string;
    tempId?: string;
    customerCode?: string;
    customerName? : string;
    invoiceId?: number;
}

export interface RawAllocation {
    amountApplied?: number;
    allocationType?: string;
    customerName?: string;
    invoiceNo?: string;
    invoiceId?: number;
    sourceTempId?: string;
    originalAmount?: number;
    remainingBalance?: number;
    totalPayments?: number;
    totalMemos?: number;
    totalReturns?: number;
    transactionDate?: string;
    dueDate?: string;
    agingDays?: number;
    history?: PaymentHistory[];
}

export interface RawTreasuryPouch {
    docNo?: string;
    isPosted?: boolean;
    collectionDate?: string;
    salesmanId?: number;
    cashBuckets?: RawCashBucket[];
    allocations?: RawAllocation[];
}

export interface RawSalesman {
    id: number;
    salesmanName: string;
}

export interface RawMemoOrReturn {
    id: number;
    amount?: number;
    appliedAmount?: number;
    memoNumber?: string;
    customerName?: string;
    isApplied?: boolean;
    totalAmount?: number;
    returnNumber?: string;
}

export interface WalletItem {
    id: string;
    type: "CASH" | "CHECK" | "MEMO" | "RETURN" | "ADJUSTMENT" | "EWT";
    label: string;
    originalAmount: number;
    dbId?: number;
    findingId?: number;
    customerName?: string;
    balanceTypeId?: number;
    isLocal?: boolean;
    invoiceId?: number;
}

export interface GeneralFinding {
    id: number;
    findingName: string;
    chartOfAccount?: { id?: number; coaId?: number; accountTitle: string; };
}

export interface DispatchPlan {
    id: number;
    docNo: string;
    driverName: string;
    vehicleName: string;
}

export function useSettlement(pouchId: string | number) {
    const [isLoading, setIsLoading] = useState(true);
    const [wallet, setWallet] = useState<WalletItem[]>([]);
    const [credits, setCredits] = useState<WalletItem[]>([]);
    const [salesmanName, setSalesmanName] = useState("Loading...");
    const [salesmanId, setSalesmanId] = useState<number | null>(null);
    const [docNo, setDocNo] = useState<string>(pouchId.toString());
    const [isPosted, setIsPosted] = useState<boolean>(false);
    const [collectionDate, setCollectionDate] = useState<string>("");
    const [cartInvoices, setCartInvoices] = useState<UnpaidInvoice[]>([]);
    const [allocations, setAllocations] = useState<SettlementAllocation[]>([]);
    const [findings, setFindings] = useState<GeneralFinding[]>([]);

    const [isLoadingRoute, setIsLoadingRoute] = useState(false);

    const [dispatchPlans, setDispatchPlans] = useState<DispatchPlan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [dispatchDate, setDispatchDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const fetchData = useCallback(async () => {
        if (!pouchId) return;
        setIsLoading(true);
        try {
            setAllocations([]);
            setCartInvoices([]);
            setWallet([]);
            setCredits([]);

            const pouch = await fetchProvider.get<RawTreasuryPouch>(`/api/fm/treasury/collections/${pouchId}`);
            if (!pouch) return;

            setDocNo(pouch.docNo || pouchId.toString());
            setIsPosted(pouch.isPosted === true);
            if (pouch.collectionDate) {
                const cDate = pouch.collectionDate.split('T')[0];
                setCollectionDate(cDate);
                setDispatchDate(cDate);
            }

            const currentSalesmanId = pouch.salesmanId || null;
            setSalesmanId(currentSalesmanId);

            const salesmen = await fetchProvider.get<RawSalesman[]>("/api/fm/treasury/salesmen");
            setSalesmanName(salesmen?.find(s => s.id === currentSalesmanId)?.salesmanName || `Owner ID: ${currentSalesmanId}`);

            try {
                const fetchedFindings = await fetchProvider.get<GeneralFinding[]>("/api/fm/treasury/collections/findings");
                setFindings(fetchedFindings || []);
            } catch (e) {
                console.warn("Could not load findings", e);
            }

            let totalCash = 0;
            const newWallet: WalletItem[] = [];
            const newCredits: WalletItem[] = [];

            pouch.cashBuckets?.forEach((b: RawCashBucket, idx: number) => {
                const safeAmount = Math.abs(b.amount || 0);
                const tempIdStr = String(b.tempId || "").toLowerCase();
                const refNo = String(b.referenceNo || "").toLowerCase();

                let wType: WalletItem["type"] = "ADJUSTMENT";
                const isCash = Number(b.coaId) === 1 || Number(b.paymentMethodId) === 1 || tempIdStr.startsWith("cash") || refNo.includes(" x ") || refNo === "cash_summary" || refNo === "physical cash";

                if (isCash) wType = "CASH";
                else if (tempIdStr.startsWith("chk") || b.paymentMethodId === 2) wType = "CHECK";
                else if (tempIdStr.startsWith("ewt") || b.paymentMethodId === 10 || b.coaId === 11) wType = "EWT";
                else if (b.paymentMethodId == null && b.coaId != null) wType = "ADJUSTMENT";
                else wType = "CHECK";

                let uniqueId = b.tempId || `${wType.toLowerCase()}-fallback-${idx}`;
                if (newWallet.some(w => w.id === uniqueId)) {
                    uniqueId = `${uniqueId}-dup-${idx}`;
                }

                if (wType === "CASH") {
                    totalCash += safeAmount;
                } else if (wType === "EWT") {
                    newWallet.push({
                        id: uniqueId,
                        type: "EWT",
                        label: b.referenceNo ? `Form 2307: ${b.referenceNo}` : 'Form 2307',
                        originalAmount: safeAmount,
                        customerName: b.customerName || b.referenceNo,
                        balanceTypeId: 2,
                        dbId: b.detailId,
                        invoiceId: b.invoiceId
                    });
                } else if (wType === "ADJUSTMENT") {
                    newWallet.push({
                        id: uniqueId,
                        type: "ADJUSTMENT",
                        label: b.referenceNo || 'Adjustment',
                        originalAmount: safeAmount,
                        customerName: b.referenceNo,
                        balanceTypeId: b.balanceTypeId || 1,
                        dbId: b.detailId,
                        findingId: b.findingId,
                        invoiceId: b.invoiceId
                    });
                } else {
                    newWallet.push({
                        id: uniqueId,
                        type: "CHECK",
                        label: b.referenceNo ? `Check/Remittance: ${b.referenceNo}` : 'No Ref',
                        originalAmount: safeAmount,
                        balanceTypeId: 2,
                        customerName: b.customerName || b.customerCode, // 🚀 Use the real name!
                        invoiceId: b.invoiceId,
                        dbId: b.detailId
                    });
                }
            });

            if (totalCash > 0) newWallet.unshift({
                id: "CASH_SUMMARY",
                type: "CASH",
                label: "Physical Cash Pool",
                originalAmount: totalCash,
                balanceTypeId: 2
            });

            try {
                const memos = await fetchProvider.get<RawMemoOrReturn[]>(`/api/fm/treasury/memos/available?salesmanId=${currentSalesmanId}`);
                memos?.forEach(m => {
                    const remainingMemoAmount = (m.amount || 0) - (m.appliedAmount || 0);
                    if (remainingMemoAmount > 0) newCredits.push({
                        id: `memo-${m.id}`,
                        dbId: m.id,
                        type: "MEMO",
                        label: `Memo: ${m.memoNumber}`,
                        originalAmount: remainingMemoAmount,
                        customerName: m.customerName
                    });
                });
            } catch (e) {
                console.warn("Could not load memos", e);
            }

            try {
                const returns = await fetchProvider.get<RawMemoOrReturn[]>(`/api/fm/treasury/returns/available?salesmanId=${currentSalesmanId}`);
                returns?.forEach(r => {
                    if (!r.isApplied) newCredits.push({
                        id: `return-${r.id}`,
                        dbId: r.id,
                        type: "RETURN",
                        label: `Return: ${r.returnNumber}`,
                        originalAmount: r.totalAmount || 0,
                        customerName: r.customerName
                    });
                });
            } catch (e) {
                console.warn("Could not load returns", e);
            }

            setWallet(newWallet);
            setCredits(newCredits);

            if (pouch.allocations && pouch.allocations.length > 0) {
                const existingAllocations: SettlementAllocation[] = [];
                const existingCartMap: Map<number, UnpaidInvoice> = new Map();

                pouch.allocations.forEach((alloc: RawAllocation) => {
                    const mappedAlloc: SettlementAllocation = {
                        invoiceId: alloc.invoiceId || 0,
                        invoiceNo: alloc.invoiceNo || "",
                        customerName: alloc.customerName || "",
                        amountApplied: Math.abs(alloc.amountApplied || 0),
                        allocationType: alloc.allocationType || "CASH",
                        sourceTempId: alloc.sourceTempId || "CASH_SUMMARY",
                        originalAmount: alloc.originalAmount || 0,
                        remainingBalance: alloc.remainingBalance || 0,
                        totalPayments: alloc.totalPayments || 0,
                        totalMemos: alloc.totalMemos || 0,
                        totalReturns: alloc.totalReturns || 0,
                        transactionDate: alloc.transactionDate || "",
                        dueDate: alloc.dueDate || "",
                        agingDays: alloc.agingDays || 0,
                        history: alloc.history || []
                    };
                    existingAllocations.push(mappedAlloc);
                    if (alloc.invoiceId && !existingCartMap.has(alloc.invoiceId)) existingCartMap.set(alloc.invoiceId, {
                        ...mappedAlloc,
                        originalAmount: alloc.originalAmount || 0,
                        id: alloc.invoiceId
                    } as unknown as UnpaidInvoice);
                });

                const finalInvoices = Array.from(existingCartMap.values()).map(inv => {
                    const myAllocs = existingAllocations.filter(a => a.invoiceId === inv.id);
                    const myPayments = myAllocs.filter(a => ["CASH", "CHECK", "EWT", "ADJUSTMENT"].includes(a.allocationType)).reduce((s, a) => s + a.amountApplied, 0);
                    const myMemos = myAllocs.filter(a => a.allocationType === "MEMO").reduce((s, a) => s + a.amountApplied, 0);
                    const myReturns = myAllocs.filter(a => a.allocationType === "RETURN").reduce((s, a) => s + a.amountApplied, 0);

                    const histPayments = Math.max(0, (inv.totalPayments || 0) - myPayments);
                    const histMemos = Math.max(0, (inv.totalMemos || 0) - myMemos);
                    const histReturns = Math.max(0, (inv.totalReturns || 0) - myReturns);

                    const trueStartingBalance = (inv.originalAmount || 0) - histPayments - histMemos - histReturns;

                    return {
                        ...inv,
                        totalPayments: histPayments,
                        totalMemos: histMemos,
                        totalReturns: histReturns,
                        remainingBalance: trueStartingBalance
                    };
                });

                setAllocations(existingAllocations);
                setCartInvoices(finalInvoices);
            }
        } catch (err) {
            console.error("Failed to fetch settlement data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [pouchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!salesmanId || !dispatchDate) return;
        setIsLoadingPlans(true);
        fetchProvider.get<DispatchPlan[]>(`/api/fm/treasury/collections/dispatch-plans?salesmanId=${salesmanId}&date=${dispatchDate}`)
            .then(data => setDispatchPlans(data || []))
            .catch(err => console.error("Failed to load dispatch plans", err))
            .finally(() => setIsLoadingPlans(false));
    }, [salesmanId, dispatchDate]);

    const editWalletItem = async (itemId: string, updatedFields: Partial<WalletItem>) => {
        const item = wallet.find(w => w.id === itemId);
        if (!item) return;

        if (!item.isLocal && (item.type === "ADJUSTMENT" || item.type === "EWT")) {
            const dbId = item.dbId;
            if (!dbId) {
                toast.error("Database ID missing. Cannot update.");
                return;
            }

            try {
                const endpoint = item.type === "EWT" ? `/api/fm/treasury/ewts/${dbId}` : `/api/fm/treasury/adjustments/${dbId}`;
                const payload = item.type === "EWT" ? {
                    amount: updatedFields.originalAmount,
                    referenceNo: updatedFields.customerName
                } : {
                    findingId: updatedFields.findingId,
                    amount: updatedFields.originalAmount,
                    balanceTypeId: updatedFields.balanceTypeId,
                    remarks: updatedFields.customerName
                };
                await fetchProvider.put(endpoint, payload);
            } catch (e) {
                console.error("Update failed", e);
                toast.error("Failed to update record in database. Ensure PUT endpoints exist.");
                return;
            }
        }

        setWallet(prev => prev.map(w => w.id === itemId ? {...w, ...updatedFields} : w));
        if (updatedFields.originalAmount !== undefined) {
            setAllocations(prev => prev.map(a => {
                if (a.sourceTempId === itemId && a.amountApplied > updatedFields.originalAmount!) {
                    return {...a, amountApplied: updatedFields.originalAmount!};
                }
                return a;
            }));
        }
    };

    const deleteWalletItem = async (itemId: string, type: string, silent = false) => {
        const item = wallet.find(w => w.id === itemId);
        if (!item) return;

        if (!item.isLocal && (type === "ADJUSTMENT" || type === "EWT")) {
            if (!silent && !confirm("This will permanently delete the record from the database. Continue?")) return;
            const dbId = item.dbId;
            if (!dbId) {
                if (!silent) toast.error("Database ID missing. Cannot delete.");
                return;
            }

            try {
                const endpoint = type === "EWT" ? `/api/fm/treasury/ewts/${dbId}` : `/api/fm/treasury/adjustments/${dbId}`;
                await fetchProvider.delete(endpoint);
            } catch (e) {
                console.error("Delete failed", e);
                if (!silent) toast.error("Failed to delete record from database.");
                return;
            }
        }

        setWallet(prev => prev.filter(w => w.id !== itemId));
        setAllocations(prev => prev.filter(a => a.sourceTempId !== itemId));
    };

    const addToCart = (invoice: Partial<UnpaidInvoice>) => {
        const safeId = invoice.id || (invoice as unknown as { invoiceId: number }).invoiceId;
        if (safeId && !cartInvoices.some(inv => inv.id === safeId)) {
            setCartInvoices(prev => [...prev, {
                ...invoice,
                originalAmount: invoice.originalAmount || 0,
                id: safeId
            } as UnpaidInvoice]);
        }
    };

    const removeFromCart = async (invoiceId: number) => {
        const linkedItems = wallet.filter(w => w.invoiceId === invoiceId && (w.type === "EWT" || w.type === "ADJUSTMENT"));
        for (const item of linkedItems) {
            await deleteWalletItem(item.id, item.type, true);
        }
        setCartInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        setAllocations(prev => prev.filter(a => a.invoiceId !== invoiceId));
    };

    const clearCart = async () => {
        if (confirm("Are you sure you want to clear all invoices and allocations from this session? Any linked Variances or EWTs will be destroyed.")) {
            const currentInvoiceIds = cartInvoices.map(inv => inv.id);
            const linkedItems = wallet.filter(w =>
                w.invoiceId !== undefined &&
                currentInvoiceIds.includes(w.invoiceId) &&
                (w.type === "EWT" || w.type === "ADJUSTMENT")
            );

            for (const item of linkedItems) {
                await deleteWalletItem(item.id, item.type, true);
            }
            setCartInvoices([]);
            setAllocations([]);
        }
    };

    const loadDispatchPlanInvoices = async (planId: number) => {
        setIsLoadingRoute(true);
        try {
            const data = await fetchProvider.get<UnpaidInvoice[]>(`/api/fm/treasury/collections/dispatch-plan-invoices?planId=${planId}`);
            const cleanResults = (data || []).filter(inv => !cartInvoices.some(cartInv => cartInv.id === (inv.id || (inv as unknown as {
                invoiceId: number
            }).invoiceId)));

            if (cleanResults.length > 0) {
                setCartInvoices(prev => [
                    ...prev,
                    ...cleanResults.map(inv => ({
                        ...inv,
                        originalAmount: inv.originalAmount || 0,
                        id: inv.id || (inv as unknown as { invoiceId: number }).invoiceId
                    }))
                ]);
            } else {
                toast.info("No additional pending invoices found for this specific Dispatch Plan.");
            }
        } catch (err) {
            console.error("Failed to load dispatch plan invoices", err);
            toast.error("Failed to fetch dispatch data.");
        } finally {
            setIsLoadingRoute(false);
        }
    };

    const loadRouteInvoices = async () => {
        if (!salesmanId || !collectionDate) return toast.error("Cannot load route: Missing Salesman ID or Date.");
        setIsLoadingRoute(true);
        try {
            const data = await fetchProvider.get<UnpaidInvoice[]>(`/api/fm/treasury/collections/route-invoices?salesmanId=${salesmanId}&date=${collectionDate}`);
            const cleanResults = (data || []).filter(inv => !cartInvoices.some(cartInv => cartInv.id === (inv.id || (inv as unknown as {
                invoiceId: number
            }).invoiceId)));
            if (cleanResults.length > 0) {
                setCartInvoices(prev => [...prev, ...cleanResults.map(inv => ({
                    ...inv,
                    originalAmount: inv.originalAmount || 0,
                    id: inv.id || (inv as unknown as { invoiceId: number }).invoiceId
                }))]);
            } else {
                toast.info("No additional pending invoices found for this route on or before " + collectionDate);
            }
        } catch (err) {
            console.error("Failed to load route invoices", err);
        } finally {
            setIsLoadingRoute(false);
        }
    };

    const getUsedAmount = (sourceId: string) => allocations.filter(a => a.sourceTempId === sourceId).reduce((sum, a) => sum + a.amountApplied, 0);
    const getInvoiceApplied = (invoiceId: number) => allocations.filter(a => a.invoiceId === invoiceId).reduce((sum, a) => sum + a.amountApplied, 0);

    const handleAllocate = (invoiceId: number, sourceId: string, amountInput: number) => {
        setAllocations(prev => {
            const filtered = prev.filter(a => !(a.invoiceId === invoiceId && a.sourceTempId === sourceId));
            const safeInput = Math.abs(amountInput);

            if (safeInput > 0.009) {
                const combinedSources = [...wallet, ...credits];
                const wItem = combinedSources.find(w => w.id === sourceId);
                const inv = cartInvoices.find(i => i.id === invoiceId);

                if (wItem && inv) {
                    let finalAmount = safeInput;

                    if (wItem.type === "MEMO" || wItem.type === "RETURN") {
                        const walletUsedElsewhere = prev.filter(a => a.sourceTempId === sourceId && a.invoiceId !== invoiceId).reduce((sum, a) => sum + a.amountApplied, 0);
                        const walletAvailable = Math.max(0, Math.abs(wItem.originalAmount) - walletUsedElsewhere);
                        finalAmount = Math.min(safeInput, walletAvailable);
                    }

                    if (finalAmount > 0.009) {
                        filtered.push({
                            invoiceId: invoiceId,
                            invoiceNo: inv.invoiceNo || "",
                            customerName: inv.customerName || "",
                            amountApplied: finalAmount,
                            allocationType: wItem.type || "CASH",
                            sourceTempId: sourceId,
                            originalAmount: inv.originalAmount || 0,
                            remainingBalance: inv.remainingBalance || 0,
                            totalPayments: inv.totalPayments || 0,
                            totalMemos: inv.totalMemos || 0,
                            totalReturns: inv.totalReturns || 0,
                            transactionDate: inv.transactionDate ? String(inv.transactionDate) : "",
                            dueDate: inv.dueDate ? String(inv.dueDate) : "",
                            agingDays: inv.agingDays || 0,
                            history: inv.history || []
                        });
                    }
                }
            }
            return filtered;
        });
    };

    const createEwt = async (amount: number, referenceNo: string, invoiceId?: number | null) => {
        try {
            const tempEwtId = `ewt-new-${Date.now()}`;
            setWallet(prev => [...prev, {
                id: tempEwtId,
                type: "EWT",
                label: `Form 2307: ${referenceNo}`,
                originalAmount: Math.abs(amount),
                customerName: referenceNo,
                balanceTypeId: 2,
                isLocal: true,
                invoiceId: invoiceId || undefined
            }]);

            if (invoiceId && amount > 0) {
                setAllocations(prevAlloc => {
                    const inv = cartInvoices.find(i => i.id === invoiceId);
                    if (!inv) return prevAlloc;
                    return [...prevAlloc, {
                        invoiceId: invoiceId,
                        invoiceNo: inv.invoiceNo || "",
                        customerName: inv.customerName || "",
                        amountApplied: amount,
                        allocationType: "EWT",
                        sourceTempId: tempEwtId,
                        originalAmount: inv.originalAmount || 0,
                        remainingBalance: inv.remainingBalance || 0,
                        totalPayments: inv.totalPayments || 0,
                        totalMemos: inv.totalMemos || 0,
                        totalReturns: inv.totalReturns || 0,
                        transactionDate: inv.transactionDate ? String(inv.transactionDate) : "",
                        dueDate: inv.dueDate ? String(inv.dueDate) : "",
                        agingDays: inv.agingDays || 0,
                        history: inv.history || []
                    }];
                });
            }
        } catch (err) {
            console.error("Failed to create EWT in UI.", err);
        }
    };

    const createAdjustment = async (findingId: number, amount: number, balanceTypeId: number, remarks?: string, invoiceId?: number | null) => {
        try {
            const finding = findings.find(f => f.id === findingId);
            const findingName = finding ? finding.findingName : "Adjustment";
            const tempAdjId = `adj-new-${Date.now()}`;

            setWallet(prev => [...prev, {
                id: tempAdjId,
                type: "ADJUSTMENT",
                label: findingName,
                originalAmount: Math.abs(amount),
                dbId: findingId,
                findingId: findingId,
                customerName: remarks,
                balanceTypeId: balanceTypeId,
                isLocal: true,
                invoiceId: invoiceId || undefined
            }]);

            if (invoiceId && amount > 0) {
                setAllocations(prevAlloc => {
                    const inv = cartInvoices.find(i => i.id === invoiceId);
                    if (!inv) return prevAlloc;
                    return [...prevAlloc, {
                        invoiceId: invoiceId,
                        invoiceNo: inv.invoiceNo || "",
                        customerName: inv.customerName || "",
                        amountApplied: Math.abs(amount),
                        allocationType: "ADJUSTMENT",
                        sourceTempId: tempAdjId,
                        originalAmount: inv.originalAmount || 0,
                        remainingBalance: inv.remainingBalance || 0,
                        totalPayments: inv.totalPayments || 0,
                        totalMemos: inv.totalMemos || 0,
                        totalReturns: inv.totalReturns || 0,
                        transactionDate: inv.transactionDate ? String(inv.transactionDate) : "",
                        dueDate: inv.dueDate ? String(inv.dueDate) : "",
                        agingDays: inv.agingDays || 0,
                        history: inv.history || []
                    }];
                });
            }
        } catch (err) {
            console.error("Failed to create temporary adjustment in UI.", err);
        }
    };

    const submitSettlement = async (): Promise<boolean> => {
        try {
            const newAdjustments = wallet.filter(w => w.type === "ADJUSTMENT" && w.isLocal).map(w => ({
                findingId: w.findingId || w.dbId,
                amount: w.originalAmount,
                balanceTypeId: w.balanceTypeId || 1,
                remarks: w.customerName || "Session Variance",
                invoiceId: allocations.find(a => a.sourceTempId === w.id)?.invoiceId || null,
                tempId: w.id
            }));

            const newEwts = wallet.filter(w => w.type === "EWT" && w.isLocal).map(w => ({
                amount: w.originalAmount,
                referenceNo: w.customerName || "Form 2307",
                tempId: w.id
            }));

            const invalidAdjustment = newAdjustments.find(a => !a.findingId);
            if (invalidAdjustment) {
                toast.error("Cannot save: An adjustment is missing a valid Finding Type.");
                return false;
            }

            const persistentAllocations: {
                invoiceId: number;
                amountApplied: number;
                allocationType: string;
                sourceTempId: string;
            }[] = [];

            cartInvoices.forEach(inv => {
                const invAllocs = allocations.filter(a => a.invoiceId === inv.id && a.amountApplied > 0);
                if (invAllocs.length > 0) {
                    persistentAllocations.push(...invAllocs.map(a => ({
                        invoiceId: a.invoiceId,
                        amountApplied: a.amountApplied,
                        allocationType: a.allocationType,
                        sourceTempId: a.sourceTempId
                    })));
                } else {
                    persistentAllocations.push({
                        invoiceId: inv.id,
                        amountApplied: 0,
                        allocationType: "NONE",
                        sourceTempId: "NONE"
                    });
                }
            });

            const payload = {newAdjustments, newEwts, allocations: persistentAllocations};
            await fetchProvider.post(`/api/fm/treasury/collections/${pouchId}/allocate`, payload);

            toast.success("Settlement successfully committed to the ledger!");
            await fetchData();
            return true;
        } catch (err) {
            toast.error("Failed to secure settlement to ledger. See console for details.");
            console.error(err);
            return false;
        }
    };

    return {
        isLoading, wallet, credits, cartInvoices, allocations, salesmanName, salesmanId, findings, docNo, isPosted,
        isLoadingRoute, addToCart, removeFromCart, clearCart, loadRouteInvoices,
        getUsedAmount, getInvoiceApplied, handleAllocate, createAdjustment, createEwt, submitSettlement,
        deleteWalletItem, editWalletItem,
        dispatchPlans, isLoadingPlans, loadDispatchPlanInvoices, dispatchDate, setDispatchDate
    };
}