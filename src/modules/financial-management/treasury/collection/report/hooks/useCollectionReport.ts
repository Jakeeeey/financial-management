"use client";

import { useState, useCallback } from "react";
// Adjust this import to match where your fetchProvider actually lives
import { fetchProvider } from "../../providers/fetchProvider";

export interface CheckDetailDto {
    date: string; docNo: string; isPosted: boolean; bankName: string; checkNo: string; customerName: string; amount: number;
}
export interface VarianceDetailDto {
    date: string; docNo: string; isPosted: boolean; type: string; accountTitle: string; remarks: string; amount: number;
}
export interface InvoiceClearedDto {
    date: string; docNo: string; isPosted: boolean; invoiceNo: string; customerName: string; paymentType: string; amountApplied: number;
}

export interface CollectionSummaryReportDto {
    startDate: string; endDate: string; generatedBy: string;
    totalPhysicalCash: number; totalChecks: number; totalEwt: number;
    totalShortages: number; totalOverages: number;
    totalInvoicesCleared: number; totalMemosConsumed: number; totalReturnsConsumed: number;
    checkBreakdown: CheckDetailDto[]; varianceBreakdown: VarianceDetailDto[]; invoiceBreakdown: InvoiceClearedDto[];
}

export function useCollectionReport() {
    const [reportData, setReportData] = useState<CollectionSummaryReportDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Default to today
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            // Hitting the Next.js API route we just made
            const data = await fetchProvider.get<CollectionSummaryReportDto>(
                `/api/fm/treasury/collections/report?startDate=${startDate}&endDate=${endDate}`
            );
            setReportData(data);
        } catch (error) {
            console.error("Failed to load collection report:", error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    return {
        reportData, isLoading, startDate, setStartDate, endDate, setEndDate, fetchReport
    };
}