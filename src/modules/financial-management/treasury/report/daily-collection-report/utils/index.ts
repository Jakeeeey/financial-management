import { format } from "date-fns";
import { CollectionItem, ChartDataPoint, PaymentTypeData, DailyVolumeDataPoint } from "../types";

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0
    }).format(amount);
};

export const processHourlyData = (data: CollectionItem[]): ChartDataPoint[] => {
    // Standard 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => {
        const rawHour = i;
        const displayHour = rawHour === 0 ? 12 : (rawHour > 12 ? rawHour - 12 : rawHour);
        const ampm = rawHour >= 12 ? 'PM' : 'AM';
        return {
            time: `${displayHour} ${ampm}`,
            amount: 0,
            rawHour
        };
    });

    data.forEach(item => {
        const timestamp = item.dateEncoded || item.collectionDate;
        if (!timestamp) return;
        
        const dateObj = new Date(timestamp);
        const hour = dateObj.getHours();
        
        const slot = hours.find(h => h.rawHour === hour);
        if (slot) slot.amount += Math.abs(item.totalAmount || 0);
    });

    return hours;
};

export const processPaymentMethodData = (data: CollectionItem[]): PaymentTypeData[] => {
    const palette = [
        "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
        "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1",
        "#a855f7", "#0ea5e9", "#f43f5e", "#84cc16", "#d946ef"
    ];
    let colorIndex = 0;
    const types: Record<string, { value: number, color: string }> = {};

    data.forEach(item => {
        const typeKey = item.type || "Unknown";
        if (!types[typeKey]) {
            types[typeKey] = { value: 0, color: palette[colorIndex % palette.length] };
            colorIndex++;
        }
        types[typeKey].value += Math.abs(item.totalAmount || 0);
    });

    return Object.entries(types)
        .filter(([, d]) => d.value > 0)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.value - a.value); 
};

export const processDetailedPaymentMethodData = (data: CollectionItem[]): PaymentTypeData[] => {
    const palette = [
        "#3b82f6", "#10b981", "#ef4444", "#06b6d4", "#f59e0b", 
        "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1"
    ];
    let colorIndex = 0;
    const methods: Record<string, { value: number, color: string }> = {};

    data.forEach(item => {
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

export const processDailyVolumeData = (data: CollectionItem[]): DailyVolumeDataPoint[] => {
    const daily: Record<string, number> = {};
    data.forEach(item => {
        const d = format(new Date(item.collectionDate), "MMM dd");
        daily[d] = (daily[d] || 0) + Math.abs(item.totalAmount || 0);
    });

    return Object.entries(daily)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([day, amount]) => ({ day, amount }));
};

export const calculateCollectionStats = (data: CollectionItem[]) => {
    const totalCollections = data.reduce((sum, item) => sum + Math.abs(item.totalAmount || 0), 0);
    const totalTransactions = data.length;
    const avgCollection = totalTransactions > 0 ? totalCollections / totalTransactions : 0;
    const uniqueSalesmen = new Set(data.map((i) => i.salesman).filter(Boolean)).size;
    const totalPosted = data.filter((i) => i.isPosted === 1).length;
    const totalPending = data.filter((i) => i.isPosted === 0 && i.isCancelled === 0).length;

    return { totalCollections, totalTransactions, avgCollection, uniqueSalesmen, totalPosted, totalPending };
};

export const extractUniqueValues = <T, K extends keyof T>(data: T[], key: K): string[] => {
    const vals = data.map((d) => String(d[key])).filter((v) => v && v !== "undefined" && v !== "null");
    return Array.from(new Set(vals)).sort();
};