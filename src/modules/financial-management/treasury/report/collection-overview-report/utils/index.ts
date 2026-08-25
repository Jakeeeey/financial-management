import { format } from "date-fns";
import {
    CollectionItem,
    OverviewStats,
    PaymentTypeData,
    SalesmanData,
    DailyTrendPoint,
    MonthlyTrendPoint,
} from "../types";

export const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
    }).format(amount);

export const calculateStats = (data: CollectionItem[]): OverviewStats => {
    const totalCollections = data.reduce((s, i) => s + Math.abs(i.totalAmount || 0), 0);
    const totalTransactions = data.length;
    const avgCollection = totalTransactions > 0 ? totalCollections / totalTransactions : 0;
    const uniqueSalesmen = new Set(data.map((i) => i.salesman).filter(Boolean)).size;
    const totalPosted = data.filter((i) => i.isPosted === 1).length;
    const totalPending = data.filter((i) => i.isPosted === 0 && i.isCancelled === 0).length;
    return { totalCollections, totalTransactions, avgCollection, uniqueSalesmen, totalPosted, totalPending };
};

export const processPaymentMethodData = (data: CollectionItem[]): PaymentTypeData[] => {
    const palette = [
        "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
        "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1",
        "#a855f7", "#0ea5e9", "#f43f5e", "#84cc16", "#d946ef",
    ];
    let colorIndex = 0;
    const types: Record<string, { value: number; color: string }> = {};
    data.forEach((item) => {
        const key = item.type || "Unknown";
        if (!types[key]) {
            types[key] = { value: 0, color: palette[colorIndex % palette.length] };
            colorIndex++;
        }
        types[key].value += Math.abs(item.totalAmount || 0);
    });
    return Object.entries(types)
        .filter(([, d]) => d.value > 0)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.value - a.value);
};

export const processDetailedPaymentMethodData = (data: CollectionItem[]): PaymentTypeData[] => {
    const palette = [
        "#3b82f6", "#10b981", "#ef4444", "#06b6d4", "#f59e0b",
        "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1",
    ];
    let colorIndex = 0;
    const methods: Record<string, { value: number; color: string }> = {};
    data.forEach((item) => {
        const key = item.paymentMethodName || item.type || "Other";
        if (!methods[key]) {
            methods[key] = { value: 0, color: palette[colorIndex % palette.length] };
            colorIndex++;
        }
        methods[key].value += Math.abs(item.totalAmount || 0);
    });
    return Object.entries(methods)
        .filter(([, d]) => d.value > 0)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.value - a.value);
};

export const processSalesmanData = (data: CollectionItem[]): SalesmanData[] => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
        if (!item.salesman) return;
        map[item.salesman] = (map[item.salesman] || 0) + Math.abs(item.totalAmount || 0);
    });
    return Object.entries(map)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
};

export const processDailyTrend = (data: CollectionItem[]): DailyTrendPoint[] => {
    const map: Record<string, { amount: number; count: number }> = {};
    data.forEach((item) => {
        const d = format(new Date(item.collectionDate), "yyyy-MM-dd");
        if (!map[d]) map[d] = { amount: 0, count: 0 };
        map[d].amount += Math.abs(item.totalAmount || 0);
        map[d].count++;
    });
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date: format(new Date(date), "MMM dd"), ...v }));
};

export const processMonthlyTrend = (data: CollectionItem[]): MonthlyTrendPoint[] => {
    const map: Record<string, { amount: number; count: number }> = {};
    data.forEach((item) => {
        const m = format(new Date(item.collectionDate), "yyyy-MM");
        if (!map[m]) map[m] = { amount: 0, count: 0 };
        map[m].amount += Math.abs(item.totalAmount || 0);
        map[m].count++;
    });
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => ({ month: format(new Date(m + "-01"), "MMM yyyy"), ...v }));
};

export const extractUniqueValues = (data: CollectionItem[], key: keyof CollectionItem): string[] =>
    [...new Set(data.map((i) => String(i[key] || "")).filter(Boolean))].sort();
