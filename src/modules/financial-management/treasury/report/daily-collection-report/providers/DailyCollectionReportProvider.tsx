"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { 
    CollectionItem, 
    DailyCollectionContextType, 
    Salesman,
} from "../types";
import { 
    formatCurrency, 
    processHourlyData, 
    processPaymentMethodData, 
    processDetailedPaymentMethodData,
    processDailyVolumeData, 
    calculateCollectionStats,
    extractUniqueValues
} from "../utils";
import { fetchProvider } from "./fetchProvider";
import { toast } from "sonner";

const DailyCollectionContext = createContext<DailyCollectionContextType | undefined>(undefined);

export function DailyCollectionReportProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawData, setRawData] = useState<CollectionItem[]>([]);
    const [salesmen, setSalesmen] = useState<Salesman[]>([]);
    const [allPaymentTypes, setAllPaymentTypes] = useState<string[]>([]);
    const [allPaymentMethods, setAllPaymentMethods] = useState<string[]>([]);
    
    // Default: Today only by default for "Daily" view
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const [filters, setFilters] = useState({
        salesman: "",
        type: "",
        isPosted: "",
        paymentMethod: "",
        docNo: ""
    });

    const fetchData = useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) return;

        setIsLoading(true);
        setError(null);
        const toastId = toast.loading("Fetching daily collection data...");
        try {
            const startStr = format(dateRange.from, "yyyy-MM-dd");
            const endStr = format(dateRange.to, "yyyy-MM-dd");
            let url = `/api/fm/treasury/report/daily-collection-report?startDate=${startStr}&endDate=${endStr}&_t=${Date.now()}`;
            
            if (filters.salesman) url += `&salesman=${encodeURIComponent(filters.salesman)}`;
            if (filters.type) url += `&type=${encodeURIComponent(filters.type)}`;
            if (filters.isPosted) url += `&isPosted=${filters.isPosted}`;
            if (filters.paymentMethod) url += `&paymentMethod=${encodeURIComponent(filters.paymentMethod)}`;
            
            const responseData = await fetchProvider.get<CollectionItem[]>(url);
            if (!responseData) {
                setRawData([]);
                setError("No data received for this period.");
                toast.error("No data received for this period.", { id: toastId });
                return;
            }
            const items = Array.isArray(responseData) ? responseData : (responseData as unknown as { data?: CollectionItem[] })?.data;

            if (items && Array.isArray(items)) {
                setRawData(items);
                if (items.length === 0) {
                    setError("No data found for this period.");
                    toast.info("No data found for this period.", { id: toastId });
                } else {
                    toast.success("Collection data loaded successfully", { id: toastId });
                    
                    // Capture unique values for filters if not currently filtering by them
                    // This ensures dropdowns don't shrink when a filter is applied
                    if (!filters.type) {
                        const types = extractUniqueValues(items, "type");
                        setAllPaymentTypes(prev => types.length >= prev.length ? types : prev);
                    }
                    if (!filters.paymentMethod) {
                        const methods = extractUniqueValues(items, "paymentMethodName");
                        setAllPaymentMethods(prev => methods.length >= prev.length ? methods : prev);
                    }
                }
            } else {
                setRawData([]);
                setError("No data received or invalid format.");
                toast.error("Invalid data format received", { id: toastId });
            }
        } catch (err: unknown) {
            console.error("Fetch Exception:", err);
            const msg = err instanceof Error ? err.message : "Connection failed.";
            setError(msg);
            setRawData([]);
            toast.error(`Failed to fetch: ${msg}`, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    }, [
        dateRange, 
        filters.salesman, 
        filters.type, 
        filters.isPosted, 
        filters.paymentMethod
    ]);

    useEffect(() => {
        const fetchSalesmen = async () => {
            try {
                const res = await fetchProvider.get<Salesman[]>("/api/fm/treasury/salesmen");
                if (!res) {
                    setSalesmen([]);
                    return;
                }
                const data = Array.isArray(res) ? res : (res as unknown as { data?: Salesman[] })?.data || [];
                setSalesmen(data);
            } catch (err) {
                console.error("Failed to load salesmen:", err);
            }
        };
        fetchSalesmen();
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = useMemo(() => {
        return rawData.filter(item => {
            const matchSalesman = !filters.salesman || item.salesman === filters.salesman;
            const matchType = !filters.type || item.type === filters.type;
            const matchPosted = !filters.isPosted || String(item.isPosted) === filters.isPosted;
            const matchMethod = !filters.paymentMethod || item.paymentMethodName === filters.paymentMethod;
            const matchDocNo = !filters.docNo || (item.docNo?.toLowerCase().includes(filters.docNo.toLowerCase()));
            return matchSalesman && matchType && matchPosted && matchMethod && matchDocNo;
        });
    }, [rawData, filters]);

    const stats = useMemo(() => calculateCollectionStats(filteredData), [filteredData]);
    const hourlyChartData = useMemo(() => processHourlyData(filteredData), [filteredData]);
    const paymentMethodData = useMemo(() => processPaymentMethodData(filteredData), [filteredData]);
    const detailedPaymentMethodData = useMemo(() => processDetailedPaymentMethodData(filteredData), [filteredData]);
    const dailyVolumeData = useMemo(() => processDailyVolumeData(filteredData), [filteredData]);


    return (
        <DailyCollectionContext.Provider value={{
            isLoading,
            error,
            reportData: filteredData,
            dateRange,
            setDateRange,
            filters,
            setFilters,
            stats,
            hourlyChartData,
            paymentMethodData,
            detailedPaymentMethodData,
            dailyVolumeData,
            paymentTypes: allPaymentTypes,
            paymentMethods: allPaymentMethods,
            salesmen,
            fetchData,
            formatCurrency
        }}>
            {children}
        </DailyCollectionContext.Provider>
    );
}

export const useDailyCollectionReport = () => {
    const context = useContext(DailyCollectionContext);
    if (!context) throw new Error("useDailyCollectionReport must be used within DailyCollectionReportProvider");
    return context;
};
