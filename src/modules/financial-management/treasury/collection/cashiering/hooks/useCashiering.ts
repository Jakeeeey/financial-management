import { useState, useEffect, useCallback } from "react";
import {
    CashieringState,
    CurrentUser,
    CollectionSummary,
    Salesman,
    CheckDetail,
    Bank,
    Denomination,
    COA
} from "../../types";
import { fetchProvider } from "../../providers/fetchProvider";

interface PouchDetailResponse {
    id: number;
    salesmanId: number;
    collectionDate: string;
    remarks: string;
    cashBuckets: {
        tempId: string;
        coaId: number;
        bankId: number | null;
        referenceNo: string;
        amount: number;
        quantity: number;
        chequeDate: string | null;
    }[];
}

export function useCashiering(currentUser: CurrentUser): CashieringState {
    const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [masterList, setMasterList] = useState<CollectionSummary[]>([]);
    const [salesmen, setSalesmen] = useState<Salesman[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [coas, setCoas] = useState<COA[]>([]);
    const [denominationMaster, setDenominationMaster] = useState<Denomination[]>([]);

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
            const [collectionsData, salesmenData, banksData, denomData, coasData] = await Promise.all([
                fetchProvider.get<CollectionSummary[]>("/api/fm/treasury/collections"),
                fetchProvider.get<Salesman[]>("/api/fm/treasury/salesmen"),
                fetchProvider.get<Bank[]>("/api/fm/treasury/bank-names"),
                fetchProvider.get<Denomination[]>("/api/fm/treasury/denominations"),
                fetchProvider.get<COA[]>("/api/fm/treasury/coas")
            ]);

            // 🚀 FIXED: Removed the Regex hack! The Next.js BFF formats this perfectly now.
            if (collectionsData) {
                setMasterList(collectionsData);
            }

            if (salesmenData) setSalesmen(salesmenData);
            if (banksData) setBanks(banksData);

            if (coasData) {
                setCoas(coasData.filter(c => c.isPayment === 1 || c.isPayment === true || c.isPaymentDuplicate));
            }

            if (denomData) {
                setDenominationMaster(denomData);
                const initialCounts = denomData.reduce((acc, d) => ({...acc, [d.id]: 0}), {});
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

    const loadPouchForEdit = useCallback(async (id: number) => {
        if (!id || isNaN(id)) return;
        setIsLoading(true);
        try {
            const pouch = await fetchProvider.get<PouchDetailResponse>(`/api/fm/treasury/collections/${id}`);
            if (pouch) {
                setEditingId(id);
                setSalesmanId(pouch.salesmanId.toString());
                setCollectionDate(pouch.collectionDate.split('T')[0]);
                setRemarks(pouch.remarks || "");

                const newDenoms: Record<number, number> = denominationMaster.reduce((acc, d) => ({...acc, [d.id]: 0}), {});
                pouch.cashBuckets?.filter((b) => b.coaId === 1).forEach((bucket) => {
                    const denomId = parseInt(bucket.tempId.replace("cash-", ""));
                    if (!isNaN(denomId)) newDenoms[denomId] = bucket.quantity;
                });

                // 🚀 FIXED: Removed the duplicate setDenominations
                setDenominations(newDenoms);

                setChecks(pouch.cashBuckets?.filter((b) => b.coaId !== 1).map((b) => ({
                    tempId: b.tempId,
                    coaId: b.coaId?.toString() || "",
                    bankId: b.bankId?.toString() || "",
                    checkNo: b.referenceNo,
                    amount: b.amount.toString(),
                    chequeDate: b.chequeDate ? b.chequeDate.split('T')[0] : ""
                })) || []);
                setIsSheetOpen(true);
            }
        } catch (err) {
            // 🚀 FIXED: Logged 'err' to satisfy ESLint
            console.error("Hydration Error:", err);
            alert("Could not load pouch details.");
        } finally {
            setIsLoading(false);
        }
    }, [denominationMaster]);

    const handleDenomChange = (id: number, qty: string) => setDenominations(prev => ({
        ...prev,
        [id]: parseInt(qty) || 0
    }));

    const addCheck = () => setChecks([...checks, {
        tempId: `chk-${Date.now()}`,
        bankId: "",
        coaId: "",
        checkNo: "",
        amount: "",
        chequeDate: ""
    }]);

    const updateCheck = (index: number, field: keyof CheckDetail, value: string) => {
        const updated = [...checks];
        updated[index][field] = value;
        setChecks(updated);
    };

    const removeCheck = (index: number) => setChecks(checks.filter((_, i) => i !== index));

    const resetForm = () => {
        setEditingId(null);
        setSalesmanId("");
        setRemarks("");
        setDenominations(denominationMaster.reduce((acc, d) => ({...acc, [d.id]: 0}), {}));
        setChecks([]);
    };

    const handleSubmit = async () => {
        if (!salesmanId) return alert("Please select a route owner.");
        if (grandTotal <= 0) return alert("Cannot save an empty pouch.");

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
                ...checks.filter(c => parseFloat(c.amount) > 0).map(c => ({
                    tempId: c.tempId,
                    coaId: parseInt(c.coaId) || 2,
                    bankId: c.bankId ? parseInt(c.bankId) : null,
                    referenceNo: c.checkNo,
                    amount: parseFloat(c.amount),
                    chequeDate: c.chequeDate ? `${c.chequeDate}T00:00:00` : null
                }))
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
            // 🚀 FIXED: Logged 'error' to satisfy ESLint
            console.error("Submission Error:", error);
            alert("Error securing pouch.");
        }
    };

    return {
        isSheetOpen, setIsSheetOpen, masterList, salesmen, isLoading, salesmanId, setSalesmanId,
        collectionDate, setCollectionDate, remarks, setRemarks, denominations, handleDenomChange,
        denominationMaster, checks, banks, coas, addCheck, updateCheck, removeCheck, totalCash,
        totalChecks, grandTotal, handleSubmit, loadPouchForEdit, resetForm,editingId
    };
}