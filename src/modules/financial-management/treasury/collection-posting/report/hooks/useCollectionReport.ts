"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchProvider } from "../providers/fetchProvider";
import { fetchCompanyProfile } from "../company-profile";
import type { CompanyProfile, CompanyProfileStatus } from "../company-profile";

import type { CollectionReportSalesman, CollectionSummaryReportDto } from "../types";

export function useCollectionReport() {
    const [reportData, setReportData] = useState<CollectionSummaryReportDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [companyProfileStatus, setCompanyProfileStatus] = useState<CompanyProfileStatus>("unavailable");
    const [salesmen, setSalesmen] = useState<CollectionReportSalesman[]>([]);
    const requestSequence = useRef(0);
    const didInitialFetch = useRef(false);

    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);

    const fetchReport = useCallback(async () => {
        const requestId = ++requestSequence.current;
        setIsLoading(true);
        setCompanyProfileStatus("loading");
        try {
            const [data, profileResult, salesmenResult] = await Promise.all([
                fetchProvider.get<CollectionSummaryReportDto>(
                    `/api/fm/treasury/collection-posting/report?startDate=${startDate}&endDate=${endDate}`
                ),
                fetchCompanyProfile().catch((error: unknown) => {
                    console.warn("Company profile is unavailable for Collection Report", error);
                    return { profile: null, status: "error" as const };
                }),
                fetchProvider.get<CollectionReportSalesman[]>("/api/fm/treasury/collection-posting/report/salesmen").catch((error: unknown) => {
                    console.warn("Salesman lookup is unavailable for Collection Report", error);
                    return [];
                }),
            ]);
            if (requestId === requestSequence.current && data) {
                setReportData(data);
                setCompanyProfile(profileResult.profile);
                setCompanyProfileStatus(profileResult.status);
                setSalesmen(salesmenResult ?? []);
            }
        } catch (error) {
            console.error("Failed to load collection report:", error);
            if (requestId === requestSequence.current) {
                setCompanyProfile(null);
                setCompanyProfileStatus("error");
                setSalesmen([]);
            }
        } finally {
            if (requestId === requestSequence.current) {
                setIsLoading(false);
            }
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (didInitialFetch.current) return;
        didInitialFetch.current = true;
        void fetchReport();
    }, [fetchReport]);

    return {
        reportData,
        isLoading,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        fetchReport,
        companyProfile,
        companyProfileStatus,
        salesmen,
    };
}
