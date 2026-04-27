"use client";

import React, {
    createContext,
    useContext,
    useState,
    useMemo,
    useEffect,
    ReactNode,
} from "react";
import { format, startOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { CollectionItem, CollectionOverviewContextType, OverviewFilters } from "../types";
import {
    formatCurrency,
    calculateStats,
    processPaymentMethodData,
    processDetailedPaymentMethodData,
    processSalesmanData,
    processDailyTrend,
    processMonthlyTrend,
    extractUniqueValues,
} from "../utils";

import { fetchProvider } from "./fetchProvider";
import { toast } from "sonner";

const CollectionOverviewContext = createContext<CollectionOverviewContextType | undefined>(undefined);

export function CollectionOverviewProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawData, setRawData] = useState<CollectionItem[]>([]);
    const [allSalesmen, setAllSalesmen] = useState<string[]>([]);
    const [allPaymentTypes, setAllPaymentTypes] = useState<string[]>([]);
    const [allPaymentMethods, setAllPaymentMethods] = useState<string[]>([]);

    // Default: current month (1st to today)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });

    const [filters, setFilters] = useState<OverviewFilters>({
        salesman: "",
        type: "",
        isPosted: "",
        paymentMethod: "",
        docNo: "",
    });

    const fetchData = React.useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) return;
        setIsLoading(true);
        setError(null);
        const toastId = toast.loading("Fetching collection overview...");
        try {
            const s = format(dateRange.from, "yyyy-MM-dd");
            const e = format(dateRange.to, "yyyy-MM-dd");
            let url = `/api/fm/treasury/report/collection-overview-report?startDate=${s}&endDate=${e}&_t=${Date.now()}`;
            if (filters.salesman) url += `&salesman=${encodeURIComponent(filters.salesman)}`;
            if (filters.type) url += `&type=${encodeURIComponent(filters.type)}`;
            if (filters.isPosted) url += `&isPosted=${filters.isPosted}`;
            if (filters.paymentMethod) url += `&paymentMethod=${encodeURIComponent(filters.paymentMethod)}`;

            const json = await fetchProvider.get<CollectionItem[]>(url);
            if (!json) {
                setRawData([]);
                setError("No data found for this period.");
                toast.error("No data found for this period.", { id: toastId });
                return;
            }
            
            const items: CollectionItem[] = Array.isArray(json) ? json : (json as unknown as { data?: CollectionItem[] })?.data ?? [];
            setRawData(items);
            if (items.length === 0) {
                setError("No data found for this period.");
                toast.info("No data found for this period.", { id: toastId });
            } else {
                toast.success("Overview data loaded successfully", { id: toastId });
                
                // Cache filter options so they don't shrink when a filter is applied
                if (!filters.salesman) {
                    const vals = extractUniqueValues(items, "salesman");
                    setAllSalesmen(prev => vals.length >= prev.length ? vals : prev);
                }
                if (!filters.type) {
                    const vals = extractUniqueValues(items, "type");
                    setAllPaymentTypes(prev => vals.length >= prev.length ? vals : prev);
                }
                if (!filters.paymentMethod) {
                    const vals = extractUniqueValues(items, "paymentMethodName");
                    setAllPaymentMethods(prev => vals.length >= prev.length ? vals : prev);
                }
            }
        } catch (err: unknown) {
            const e = err as Error;
            const msg = e.message || "Connection failed.";
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

    useEffect(() => { fetchData(); }, [fetchData]);
    
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



    const stats = useMemo(() => calculateStats(filteredData), [filteredData]);
    const paymentMethodData = useMemo(() => processPaymentMethodData(filteredData), [filteredData]);
    const detailedPaymentMethodData = useMemo(() => processDetailedPaymentMethodData(filteredData), [filteredData]);
    const salesmanData = useMemo(() => processSalesmanData(filteredData), [filteredData]);
    const dailyTrend = useMemo(() => processDailyTrend(filteredData), [filteredData]);
    const monthlyTrend = useMemo(() => processMonthlyTrend(filteredData), [filteredData]);

    return (
        <CollectionOverviewContext.Provider value={{
            isLoading, error, reportData: filteredData,
            dateRange, setDateRange,
            filters, setFilters,
            stats, paymentMethodData, detailedPaymentMethodData, salesmanData, dailyTrend, monthlyTrend,
            salesmen: allSalesmen, paymentTypes: allPaymentTypes, paymentMethods: allPaymentMethods, fetchData, formatCurrency,
        }}>
            {children}
        </CollectionOverviewContext.Provider>
    );
}

export const useCollectionOverview = () => {
    const ctx = useContext(CollectionOverviewContext);
    if (!ctx) throw new Error("useCollectionOverview must be used within CollectionOverviewProvider");
    return ctx;
};
