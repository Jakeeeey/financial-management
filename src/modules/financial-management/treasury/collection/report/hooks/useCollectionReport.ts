"use client";

import { useState, useCallback } from "react";
import { fetchProvider } from "../../providers/fetchProvider";

export interface CheckDetailDto { date: string; docNo: string; bankName: string; checkNo: string; customerName: string; amount: number; }
export interface VarianceDetailDto { docNo: string; type: string; accountTitle: string; remarks: string; amount: number; }

// 🚀 NEW: Hierarchical Invoice Structure
export interface SettledInvoiceDto {
    invoiceNo: string;
    customerName: string;
    invoiceTotal: number; // <--- This was missing!
    grossAmount: number;
    memoAmount: number;
    returnAmount: number;
    netAmount: number;
}

export interface PouchReportDto {
    docNo: string; date: string; isPosted: boolean;
    totalCash: number; totalCheck: number;
    shortage: number; overage: number;
    totalInvoices: number; totalMemos: number; totalReturns: number;
    invoiceNetTotal: number;
    checks: CheckDetailDto[]; variances: VarianceDetailDto[]; invoices: SettledInvoiceDto[];
}

export interface CollectionSummaryReportDto {
    startDate: string; endDate: string; generatedBy: string;
    globalCash: number; globalChecks: number;
    globalShortages: number; globalOverages: number; globalNetInvoice: number;
    pouches: PouchReportDto[];
}

export function useCollectionReport() {
    const [reportData, setReportData] = useState<CollectionSummaryReportDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
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

    return { reportData, isLoading, startDate, setStartDate, endDate, setEndDate, fetchReport };
}