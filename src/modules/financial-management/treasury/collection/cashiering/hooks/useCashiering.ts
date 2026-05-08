"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchProvider } from "../../providers/fetchProvider";
import {
    CurrentUser, CollectionSummary, Salesman, Bank, Denomination,
    COA, PaymentMethod, Customer, UnpaidInvoice, CheckDetail
} from "../../types";

interface PouchDetailResponse {
    id: number;
    salesmanId: number;
    collectionDate: string;
    remarks: string;
    cashBuckets: {
        tempId: string;
        paymentMethodId?: number;
        coaId: number;
        bankId: number | null;
        customerCode?: string;
        invoiceId?: number;
        referenceNo: string;
        amount: number;
        quantity: number;
        chequeDate: string | null;
    }[];
}

export function useCashiering(currentUser: CurrentUser) {
    const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSheetLoading, setIsSheetLoading] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [masterList, setMasterList] = useState<CollectionSummary[]>([]);
    const [salesmen, setSalesmen] = useState<Salesman[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [coas, setCoas] = useState<COA[]>([]);
    const [denominationMaster, setDenominationMaster] = useState<Denomination[]>([]);

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [customerInvoices, setCustomerInvoices] = useState<Record<string, UnpaidInvoice[]>>({});
    const [routeInvoices, setRouteInvoices] = useState<UnpaidInvoice[]>([]);

    const [salesmanId, setSalesmanId] = useState<string>("");
    const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState<string>("");

    const [denominations, setDenominations] = useState<Record<number, number>>({});
    const [checks, setChecks] = useState<CheckDetail[]>([]);

    const totalCash = denominationMaster.reduce((sum, d) => sum + (d.amount * (denominations[d.id] || 0)), 0);
    const totalChecks = checks.reduce((sum, check) => sum + (parseFloat(check.amount) || 0), 0);
    const grandTotal = totalCash + totalChecks;

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [collectionsData, salesmenData, banksData, denomData, coasData, pmData, custData] = await Promise.all([
                fetchProvider.get<CollectionSummary[]>("/api/fm/treasury/collections"),
                fetchProvider.get<Salesman[]>("/api/fm/treasury/salesmen"),
                fetchProvider.get<Bank[]>("/api/fm/treasury/bank-names"),
                fetchProvider.get<Denomination[]>("/api/fm/treasury/denominations"),
                fetchProvider.get<COA[]>("/api/fm/treasury/coas"),
                fetchProvider.get<PaymentMethod[]>("/api/fm/treasury/payment-methods").catch(() => [] as PaymentMethod[]),
                fetchProvider.get<Customer[]>("/api/fm/treasury/customers").catch(() => [] as Customer[])
            ]);

            if (collectionsData) setMasterList(collectionsData);
            if (salesmenData) setSalesmen(salesmenData);
            if (banksData) setBanks(banksData);
            if (custData) setCustomers(custData);

            if (pmData) {
                setPaymentMethods(pmData.filter((pm: PaymentMethod) => pm.methodId !== 1 && pm.methodName.toLowerCase() !== "cash"));
            }

            if (coasData) {
                setCoas(coasData.filter(c => c.isPayment === 1 || c.isPayment === true || c.isPaymentDuplicate));
            }

            if (denomData) {
                setDenominationMaster(denomData);
                const initialCounts = denomData.reduce<Record<number, number>>((acc, d) => ({ ...acc, [d.id]: 0 }), {});
                setDenominations(initialCounts);
            }
        } catch (error) {
            console.error("Failed to fetch live data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        if (salesmanId) {
            fetchProvider.get<UnpaidInvoice[]>(`/api/fm/treasury/collections/unpaid-invoices?salesmanId=${salesmanId}`)
                .then(data => setRouteInvoices(data || []))
                .catch(err => console.error("Failed to load route invoices", err));
        } else {
            setRouteInvoices([]);
        }
    }, [salesmanId]);

    const loadPouchForEdit = useCallback(async (id: number) => {
        if (!id || isNaN(id)) return;
        setIsSheetLoading(true);
        setIsSheetOpen(true);

        try {
            const pouch = await fetchProvider.get<PouchDetailResponse>(`/api/fm/treasury/collections/${id}`);
            if (pouch) {
                setEditingId(id);
                setSalesmanId(pouch.salesmanId.toString());
                setCollectionDate(pouch.collectionDate.split('T')[0]);
                setRemarks(pouch.remarks || "");

                const newDenoms: Record<number, number> = denominationMaster.reduce<Record<number, number>>((acc, d) => ({ ...acc, [d.id]: 0 }), {});

                pouch.cashBuckets?.filter((b) => b.coaId === 1).forEach((bucket) => {
                    const denomId = parseInt(bucket.tempId.replace("cash-", ""));
                    if (!isNaN(denomId)) newDenoms[denomId] = bucket.quantity;
                });

                setDenominations(newDenoms);

                const mappedChecks = pouch.cashBuckets?.filter((b) => b.coaId !== 1).map((b) => {
                    const custObj = customers.find(c => (c.customerCode || c.code) === b.customerCode);
                    return {
                        tempId: b.tempId,
                        paymentMethodId: b.paymentMethodId?.toString() || "",
                        coaId: b.coaId?.toString() || "",
                        bankId: b.bankId?.toString() || "",
                        customerId: custObj ? custObj.id.toString() : "",
                        invoiceId: b.invoiceId?.toString() || "",
                        checkNo: b.referenceNo,
                        amount: b.amount.toString(),
                        chequeDate: b.chequeDate ? b.chequeDate.split('T')[0] : ""
                    };
                }) || [];
                setChecks(mappedChecks);

                const uniqueCustomerIds = Array.from(new Set(mappedChecks.map(c => c.customerId).filter(Boolean)));
                await Promise.all(uniqueCustomerIds.map(async (cId) => {
                    if (cId) {
                        try {
                            const data = await fetchProvider.get<UnpaidInvoice[]>(`/api/fm/treasury/collections/unpaid-invoices?salesmanId=${pouch.salesmanId}&customerId=${cId}`);
                            setCustomerInvoices(prev => ({ ...prev, [cId]: data || [] }));
                        } catch (err) {
                            console.warn("Could not preload invoices for customer", cId);
                            console.error(err);
                        }
                    }
                }));
            }
        } catch (err) {
            console.error("Hydration Error:", err);
            alert("Could not load pouch details.");
        } finally {
            setIsSheetLoading(false);
        }
    }, [denominationMaster, customers]);

    const handleDenomChange = (id: number, qty: string) => setDenominations(prev => ({
        ...prev,
        [id]: parseInt(qty) || 0
    }));

    const addCheck = () => setChecks([...checks, {
        tempId: `chk-${Date.now()}`,
        paymentMethodId: "",
        coaId: "",
        bankId: "",
        customerId: "",
        invoiceId: "",
        checkNo: "",
        amount: "",
        chequeDate: ""
    }]);

    const updateCheck = (index: number, field: keyof CheckDetail, value: string) => {
        const updated = [...checks];
        updated[index][field] = value;
        setChecks(updated);
    };

    const handlePaymentMethodSelect = (index: number, methodId: string) => {
        const updated = [...checks];
        updated[index].paymentMethodId = methodId;
        const method = paymentMethods.find(m => m.methodId.toString() === methodId);
        if (method && method.coaId) {
            updated[index].coaId = method.coaId.toString();
        }
        setChecks(updated);
    };

    const handleCustomerSelect = async (index: number, customerId: string) => {
        const updated = [...checks];
        updated[index].customerId = customerId;
        updated[index].invoiceId = "";
        setChecks(updated);

        if (salesmanId && customerId && !customerInvoices[customerId]) {
            try {
                const data = await fetchProvider.get<UnpaidInvoice[]>(`/api/fm/treasury/collections/unpaid-invoices?salesmanId=${salesmanId}&customerId=${customerId}`);
                setCustomerInvoices(prev => ({ ...prev, [customerId]: data || [] }));
            } catch (err) {
                console.error("Failed to load customer invoices", err);
            }
        }
    };

    const handleInvoiceSelect = (index: number, invoiceId: string) => {
        const updated = [...checks];
        updated[index].invoiceId = invoiceId;

        if (!updated[index].customerId && routeInvoices.length > 0) {
            const selectedInv = routeInvoices.find(inv => (inv.invoiceId || inv.id)?.toString() === invoiceId);
            if (selectedInv) {
                const custMatch = customers.find(c => (c.customerName || c.name) === selectedInv.customerName);
                if (custMatch) {
                    updated[index].customerId = custMatch.id.toString();
                }
            }
        }
        setChecks(updated);
    };

    const removeCheck = (index: number) => setChecks(checks.filter((_, i) => i !== index));

    const resetForm = () => {
        setEditingId(null);
        setSalesmanId("");
        setRemarks("");
        setDenominations(denominationMaster.reduce<Record<number, number>>((acc, d) => ({ ...acc, [d.id]: 0 }), {}));
        setChecks([]);
        setCustomerInvoices({});
    };

    const handleSubmit = async () => {
        if (!salesmanId) return alert("Please select a Collector.");
        if (grandTotal <= 0) return alert("Cannot save an empty pouch.");
        if (!checks.every(c => c.bankId && c.bankId !== "")) return alert("All non-cash assets require a Target Bank selection.");

        setIsSubmitting(true);

        const payload = {
            salesmanId: parseInt(salesmanId),
            collectedBy: parseInt(currentUser.id) || 1,
            collectionDate: `${collectionDate}T00:00:00`,
            remarks: remarks || "",
            cashBuckets: [
                ...denominationMaster.filter(d => (denominations[d.id] || 0) > 0).map(d => ({
                    tempId: `cash-${d.id}`,
                    coaId: 1,
                    amount: d.amount * denominations[d.id],
                    quantity: denominations[d.id],
                    referenceNo: `${d.amount} x ${denominations[d.id]}`
                })),
                ...checks.filter(c => parseFloat(c.amount) > 0).map(c => {
                    const custObj = customers.find(cust => cust.id.toString() === c.customerId);
                    return {
                        tempId: c.tempId,
                        paymentMethodId: c.paymentMethodId ? parseInt(c.paymentMethodId) : null,
                        coaId: parseInt(c.coaId) || 2,
                        bankId: c.bankId ? parseInt(c.bankId) : null,
                        customerCode: custObj ? (custObj.customerCode || custObj.code) : null,
                        invoiceId: c.invoiceId ? parseInt(c.invoiceId) || null : null,
                        referenceNo: c.checkNo,
                        amount: parseFloat(c.amount),
                        chequeDate: c.chequeDate ? `${c.chequeDate}T00:00:00` : null
                    };
                })
            ]
        };

        try {
            const method = editingId ? fetchProvider.put : fetchProvider.post;
            const url = editingId ? `/api/fm/treasury/collections/${editingId}` : "/api/fm/treasury/collections/receive";
            const res = await method<string>(url, payload);
            if (res) {
                alert(editingId ? "Pouch updated!" : "Pouch secured!");
                setIsSheetOpen(false);
                resetForm();
                fetchInitialData();
            }
        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error securing pouch.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        isSheetOpen, setIsSheetOpen, isSheetLoading, isSubmitting, masterList, salesmen, isLoading, salesmanId, setSalesmanId,
        collectionDate, setCollectionDate, remarks, setRemarks, denominations, handleDenomChange,
        denominationMaster, checks, banks, coas, paymentMethods, customers, customerInvoices, routeInvoices,
        addCheck, updateCheck, handlePaymentMethodSelect, handleCustomerSelect, handleInvoiceSelect, removeCheck, totalCash,
        totalChecks, grandTotal, handleSubmit, loadPouchForEdit, resetForm, editingId
    };
}