import { DateRange } from "react-day-picker";

export interface CollectionItem {
    id: number;
    docNo: string;
    receiptNo: string;
    collectionDate: string;
    dateEncoded: string;
    salesmanId: number;
    salesman: string;
    collectedById: number;
    collectedBy: string;
    type: string;
    detailAmount: number;
    detailRemarks: string;
    totalAmount: number;
    remarks: string;
    isPosted: number;
    isCancelled: number;
    paymentMethodId?: number;
    paymentMethodName?: string;
}

export interface OverviewStats {
    totalCollections: number;
    totalTransactions: number;
    avgCollection: number;
    uniqueSalesmen: number;
    totalPosted: number;
    totalPending: number;
}

export interface PaymentTypeData {
    name: string;
    value: number;
    color: string;
}

export interface SalesmanData {
    name: string;
    amount: number;
}

export interface DailyTrendPoint {
    date: string;
    amount: number;
    count: number;
}

export interface MonthlyTrendPoint {
    month: string;
    amount: number;
    count: number;
}

export interface OverviewFilters {
    salesman: string;
    type: string;
    isPosted: string;
    paymentMethod: string;
    docNo: string;
}

export interface CollectionOverviewContextType {
    isLoading: boolean;
    error: string | null;
    reportData: CollectionItem[];
    dateRange: DateRange | undefined;
    setDateRange: (range: DateRange | undefined) => void;
    filters: OverviewFilters;
    setFilters: (f: OverviewFilters) => void;
    stats: OverviewStats;
    paymentMethodData: PaymentTypeData[];
    detailedPaymentMethodData: PaymentTypeData[];
    salesmanData: SalesmanData[];
    dailyTrend: DailyTrendPoint[];
    monthlyTrend: MonthlyTrendPoint[];
    salesmen: string[];
    paymentTypes: string[];
    paymentMethods: string[];
    fetchData: () => Promise<void>;
    formatCurrency: (v: number) => string;
}
