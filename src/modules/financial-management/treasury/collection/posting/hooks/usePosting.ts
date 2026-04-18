"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchProvider } from "../../providers/fetchProvider";

export interface PostingQueueItem {
    id: number;
    docNo: string;
    salesmanName: string;
    operationName: string;
    encoderName: string;
    collectionDate: string;
    pouchAmount: number;
    totalAppliedAmount: number;
    adjustmentDebit: number;
    adjustmentCredit: number;
}

// 🚀 NEW: A strict interface for the raw API response so we don't use 'any'
interface RawQueueItem {
    id?: number;
    docNo?: string;
    salesmanName?: string;
    operationName?: string;
    encoderName?: string;
    collectionDate?: string;
    pouchAmount?: number;
    totalAppliedAmount?: number;
    adjustmentDebit?: number;
    adjustmentCredit?: number;
}

// 🚀 NEW: Define the combined detail type that the ReviewSheet expects
export interface TreasuryPouchDetail extends PostingQueueItem {
    remarks?: string;
    cashBuckets?: {
        amount?: number;
        paymentMethod?: string;
        balanceTypeId?: number;
        referenceNo?: string;
        bankName?: string;
        checkNo?: string;
        checkDate?: string;
    }[];
    allocations?: {
        amountApplied?: number;
        allocationType?: string;
        customerName?: string;
        invoiceNo?: string;
        invoiceId?: string | number;
        referenceNo?: string;
    }[];
}

export function usePosting() {
    const [queue, setQueue] = useState<PostingQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedPouch, setSelectedPouch] = useState<TreasuryPouchDetail | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            // 🚀 Perfectly typed GET request
            const data = await fetchProvider.get<RawQueueItem[]>("/api/fm/treasury/collections/posting-queue");

            const formattedQueue: PostingQueueItem[] = (data || []).map((item) => ({
                id: item.id || 0,
                docNo: item.docNo || "UNKNOWN",
                salesmanName: item.salesmanName || "Unknown Route",
                operationName: item.operationName || "Unassigned Operation",
                encoderName: item.encoderName || "Cashier",
                collectionDate: item.collectionDate?.split('T')[0] || "N/A",
                pouchAmount: item.pouchAmount || 0,
                totalAppliedAmount: item.totalAppliedAmount || 0,
                adjustmentDebit: item.adjustmentDebit || 0,
                adjustmentCredit: item.adjustmentCredit || 0
            }));

            setQueue(formattedQueue);
        } catch (err) {
            console.error("Failed to fetch posting queue", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const openReviewSheet = async (id: number) => {
        setIsReviewSheetOpen(true);
        setIsLoadingDetails(true);
        setSelectedPouch(null);
        try {
            // 1. Fetch the deep anatomical breakdown
            const details = await fetchProvider.get<Partial<TreasuryPouchDetail>>(`/api/fm/treasury/collections/${id}`);

            // 2. Find the perfectly formatted summary data from our queue
            const queueSummaryData = queue.find(q => q.id === id);

            // 3. MERGE THEM!
            if (queueSummaryData) {
                setSelectedPouch({
                    ...details,
                    ...queueSummaryData
                } as TreasuryPouchDetail);
            }

        } catch (err) {
            console.error("Failed to fetch pouch details", err);
            alert("Could not load pouch details.");
            setIsReviewSheetOpen(false);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handlePostPouch = async (id: number, docNo: string, shortageAmount: number) => {
        const warningMsg = shortageAmount > 0
            ? `WARNING: This pouch has a SHORTAGE of ₱${shortageAmount.toLocaleString()}.\n\nPosting this will permanently lock the pouch AND automatically generate a Payroll Audit Finding for the Route Manager.\n\nAre you sure you want to POST?`
            : `Are you sure you want to permanently POST and lock pouch ${docNo}?`;

        if (!confirm(warningMsg)) return;

        setIsPosting(true);
        try {
            await fetchProvider.post(`/api/fm/treasury/collections/${id}/post`, {});
            alert(`Pouch ${docNo} has been successfully posted to the General Ledger!`);
            setIsReviewSheetOpen(false);
            await fetchQueue();
        } catch (err: unknown) {
            // 🚀 Safely check if the unknown error has a message property
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            alert(`Failed to post pouch: ${errorMessage}`);
        } finally {
            setIsPosting(false);
        }
    };

    return {
        queue, isLoading, isPosting, refreshQueue: fetchQueue,
        selectedPouch, isLoadingDetails, isReviewSheetOpen, setIsReviewSheetOpen,
        openReviewSheet, handlePostPouch
    };
}