"use client";

import { useState, useCallback, useEffect, useRef } from "react";
// 🚀 FIXED: Pointing directly to your existing provider!
import { disbursementProvider } from "../providers/fetchProvider";
import { DisbursementDashboardData, DashboardFilters } from "../types";
import { getManilaDateInput, getManilaMonthStartInput } from "../utils/disbursement-utils";

export function useDisbursementDashboard() {
    const [data, setData] = useState<DisbursementDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const requestIdRef = useRef(0);

    // Default filters: Current month up to today
    const [filters, setFilters] = useState<DashboardFilters>({
        status: "ALL",
        startDate: getManilaMonthStartInput(),
        endDate: getManilaDateInput(),
    });

    const fetchDashboard = useCallback(async (currentFilters: DashboardFilters) => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        try {
            // 🚀 FIXED: Calling the getDashboardData method we added to your provider
            const result = await disbursementProvider.getDashboardData(currentFilters);
            if (requestId === requestIdRef.current && result) {
                setData(result);
            }
        } catch (err) {
            if (requestId === requestIdRef.current) {
                console.error("Failed to fetch dashboard data", err);
            }
        } finally {
            if (requestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    // Initial load and refetch when filters change
    useEffect(() => {
        fetchDashboard(filters);
    }, [fetchDashboard, filters]);

    const handleApplyFilters = () => {
        fetchDashboard(filters);
    };

    return {
        data,
        filters,
        setFilters,
        isLoading,
        handleApplyFilters
    };
}
