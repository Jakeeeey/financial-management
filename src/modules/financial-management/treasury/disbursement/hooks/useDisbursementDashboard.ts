"use client";

import { useState, useCallback, useEffect, useRef } from "react";
// 🚀 FIXED: Pointing directly to your existing provider!
import { disbursementProvider } from "../providers/fetchProvider";
import { DisbursementDashboardData, DashboardFilters } from "../types";

export function useDisbursementDashboard() {
    const [data, setData] = useState<DisbursementDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const requestIdRef = useRef(0);

    // Default filters: Current month up to today
    const [filters, setFilters] = useState<DashboardFilters>({
        status: "ALL",
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
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
