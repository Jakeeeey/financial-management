"use client";

import {useState, useEffect, useCallback} from "react";
import {UnpaidInvoice, SettlementAllocation, PaymentHistory} from "../../types";
import {fetchProvider} from "../../providers/fetchProvider";

export interface RawCashBucket {
    amount?: number;
    paymentMethod?: string;
    balanceTypeId?: number;
    referenceNo?: string;
    bankName?: string;
    checkNo?: string;
    checkDate?: string;
    tempId?: string;
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
    customerName?: string;
    balanceTypeId?: number;
    isLocal?: boolean;
}

export interface GeneralFinding {
    id: number;
    findingName: string;
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
                setCollectionDate(pouch.collectionDate.split('T')[0]);
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

                if (b.tempId && b.tempId.startsWith("cash-")) {
                    totalCash += safeAmount;
                } else if (b.tempId && b.tempId.startsWith("ewt-")) {
                    newWallet.push({
                        id: b.tempId,
                        type: "EWT",
                        label: b.referenceNo ? `Form 2307: ${b.referenceNo}` : 'Form 2307',
                        originalAmount: safeAmount,
                        balanceTypeId: 2
                    });
                } else if (b.tempId && b.tempId.startsWith("adj-")) {
                    newWallet.push({
                        id: b.tempId,
                        type: "ADJUSTMENT",
                        label: b.referenceNo || 'Adjustment',
                        originalAmount: safeAmount,
                        balanceTypeId: b.balanceTypeId || 1
                    });
                } else {
                    newWallet.push({
                        id: b.tempId || `chk-fallback-${idx}`,
                        type: "CHECK",
                        label: b.referenceNo ? `Check: ${b.referenceNo}` : 'No Ref',
                        originalAmount: safeAmount,
                        balanceTypeId: 2
                    });
                }
            });

            if (totalCash > 0) {
                newWallet.unshift({
                    id: "CASH_SUMMARY",
                    type: "CASH",
                    label: "Physical Cash Pool",
                    originalAmount: totalCash,
                    balanceTypeId: 2
                });
            }

            try {
                const memos = await fetchProvider.get<RawMemoOrReturn[]>(`/api/fm/treasury/memos/available?salesmanId=${currentSalesmanId}`);
                memos?.forEach(m => {
                    const remainingMemoAmount = (m.amount || 0) - (m.appliedAmount || 0);
                    if (remainingMemoAmount > 0) {
                        newCredits.push({
                            id: `memo-${m.id}`,
                            dbId: m.id,
                            type: "MEMO",
                            label: `Memo: ${m.memoNumber}`,
                            originalAmount: remainingMemoAmount,
                            customerName: m.customerName
                        });
                    }
                });
            } catch (e: unknown) {
                console.warn("Could not load memos", e);
            }

            try {
                const returns = await fetchProvider.get<RawMemoOrReturn[]>(`/api/fm/treasury/returns/available?salesmanId=${currentSalesmanId}`);
                returns?.forEach(r => {
                    if (!r.isApplied) {
                        newCredits.push({
                            id: `return-${r.id}`,
                            dbId: r.id,
                            type: "RETURN",
                            label: `Return: ${r.returnNumber}`,
                            originalAmount: r.totalAmount || 0,
                            customerName: r.customerName
                        });
                    }
                });
            } catch (e: unknown) {
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

                    if (alloc.invoiceId && !existingCartMap.has(alloc.invoiceId)) {
                        existingCartMap.set(alloc.invoiceId, {
                            ...mappedAlloc,
                            id: alloc.invoiceId
                        } as unknown as UnpaidInvoice);
                    }
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

    const addToCart = (invoice: Partial<UnpaidInvoice>) => {
        const safeId = invoice.id || (invoice as unknown as { invoiceId: number }).invoiceId;
        if (safeId && !cartInvoices.some(inv => inv.id === safeId)) {
            setCartInvoices(prev => [...prev, {...invoice, id: safeId} as UnpaidInvoice]);
        }
    };

    const removeFromCart = (invoiceId: number) => {
        setCartInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        setAllocations(prev => prev.filter(a => a.invoiceId !== invoiceId));
    };

    const clearCart = () => {
        if (confirm("Are you sure you want to clear all invoices and allocations from this session?")) {
            setCartInvoices([]);
            setAllocations([]);
        }
    };

    // 🚀 NEW: Lets you delete an adjustment or EWT from the wallet
    const deleteWalletItem = (itemId: string) => {
        setWallet(prev => prev.filter(w => w.id !== itemId));
        setAllocations(prev => prev.filter(a => a.sourceTempId !== itemId));
    };

    const loadRouteInvoices = async () => {
        if (!salesmanId || !collectionDate) {
            alert("Cannot load route: Missing Salesman ID or Collection Date.");
            return;
        }
        setIsLoadingRoute(true);
        try {
            const data = await fetchProvider.get<UnpaidInvoice[]>(
                `/api/fm/treasury/collections/route-invoices?salesmanId=${salesmanId}&date=${collectionDate}`
            );

            const cleanResults = (data || []).filter(inv => !cartInvoices.some(cartInv => cartInv.id === (inv.id || (inv as unknown as {
                invoiceId: number
            }).invoiceId)));

            if (cleanResults.length > 0) {
                setCartInvoices(prev => [
                    ...prev,
                    ...cleanResults.map(inv => ({
                        ...inv,
                        id: inv.id || (inv as unknown as { invoiceId: number }).invoiceId
                    }))
                ]);
            } else {
                alert("No additional pending invoices found for this route on or before " + collectionDate);
            }
        } catch (err) {
            console.error("Failed to load route invoices", err);
            alert("Failed to fetch route data. Check your backend endpoint.");
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
                    const walletUsedElsewhere = prev
                        .filter(a => a.sourceTempId === sourceId && a.invoiceId !== invoiceId)
                        .reduce((sum, a) => sum + a.amountApplied, 0);

                    const walletAvailable = Math.max(0, Math.abs(wItem.originalAmount) - walletUsedElsewhere);

                    const invoicePaidElsewhere = prev
                        .filter(a => a.invoiceId === invoiceId && a.sourceTempId !== sourceId)
                        .reduce((sum, a) => sum + a.amountApplied, 0);

                    const invoiceAvailable = Math.max(0, (inv.remainingBalance || 0) - invoicePaidElsewhere);

                    const maxAllowed = Math.min(walletAvailable, invoiceAvailable);
                    const finalAmount = Math.min(safeInput, maxAllowed);

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

    // 🚀 FIXED: Made invoiceId optional so it can be pooled!
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
                isLocal: true
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
                customerName: remarks,
                balanceTypeId: balanceTypeId,
                isLocal: true
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

    const submitSettlement = async () => {
        try {
            const newAdjustments = wallet
                .filter(w => w.type === "ADJUSTMENT" && w.isLocal)
                .map(w => ({
                    findingId: w.dbId,
                    amount: w.originalAmount,
                    balanceTypeId: w.balanceTypeId || 1,
                    remarks: w.customerName || "Session Variance",
                    invoiceId: allocations.find(a => a.sourceTempId === w.id)?.invoiceId || null,
                    tempId: w.id
                }));

            const newEwts = wallet
                .filter(w => w.type === "EWT" && w.isLocal)
                .map(w => ({
                    amount: w.originalAmount,
                    referenceNo: w.customerName || "Form 2307",
                    tempId: w.id
                }));

            const invalidAdjustment = newAdjustments.find(a => !a.findingId);
            if (invalidAdjustment) {
                alert("Cannot save: An adjustment is missing a valid Finding Type.");
                return;
            }

            const payload = {
                newAdjustments: newAdjustments,
                newEwts: newEwts,
                allocations: allocations.filter(a => a.amountApplied > 0).map(a => ({
                    invoiceId: a.invoiceId,
                    amountApplied: a.amountApplied,
                    allocationType: a.allocationType,
                    sourceTempId: a.sourceTempId
                }))
            };

            await fetchProvider.post(`/api/fm/treasury/collections/${pouchId}/allocate`, payload);
            alert("Settlement Saved Successfully!");
            await fetchData();
        } catch (err) {
            alert("Failed to settle pouch.");
            console.error(err);
        }
    };
    return {
        isLoading, wallet, credits, cartInvoices, allocations, salesmanName, salesmanId, findings, docNo, isPosted,
        isLoadingRoute,
        addToCart, removeFromCart, clearCart, loadRouteInvoices,
        getUsedAmount, getInvoiceApplied, handleAllocate, createAdjustment, createEwt, submitSettlement, deleteWalletItem // 🚀 Added to returns
    };
}