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

export interface CollectionStats {
    totalCollections: number;
    totalTransactions: number;
    avgCollection: number;
    uniqueSalesmen: number;
    totalPosted: number;
    totalPending: number;
}

export interface ChartDataPoint {
    time: string;
    amount: number;
    rawHour?: number;
}

export interface PaymentTypeData {
    name: string;
    value: number;
    color: string;
}

export interface DailyVolumeDataPoint {
    day: string;
    amount: number;
}

export interface DailyCollectionFilters {
    salesman: string;
    type: string;
    isPosted: string;
    paymentMethod: string;
    docNo: string;
}

export interface Salesman {
    id: number | string;
    name?: string;
    fullname?: string;
    salesmanName?: string;
    firstName?: string;
    lastName?: string;
}

export interface DailyCollectionContextType {
    isLoading: boolean;
    error: string | null;
    reportData: CollectionItem[];
    dateRange: DateRange | undefined;
    setDateRange: (range: DateRange | undefined) => void;
    filters: DailyCollectionFilters;
    setFilters: (filters: DailyCollectionFilters) => void;
    stats: CollectionStats;
    hourlyChartData: ChartDataPoint[];
    paymentMethodData: PaymentTypeData[];
    detailedPaymentMethodData: PaymentTypeData[];
    dailyVolumeData: DailyVolumeDataPoint[];
    paymentTypes: string[];
    paymentMethods: string[];
    salesmen: Salesman[];
    fetchData: () => Promise<void>;
    formatCurrency: (amount: number) => string;
}
