export type DateBasis = "Manual" | "Monthly" | "Quarterly" | "Annually";

export interface ReportFilters {
    dateBasis: DateBasis;
    dateFrom?: string;
    dateTo?: string;
    month?: string;
    year?: string;
    quarter?: string;
    division: string;
    department: string;
    enableComparison: boolean;
    comparisonBasis: DateBasis;
    comparisonPeriod?: string;
}

export type AccountType = "Assets" | "Liabilities" | "Equity" | string;
export type AccountGroup =
    | "Current Assets" | "Non-Current Assets"
    | "Current Liabilities" | "Non-Current Liabilities"
    | "Equity" | "Equity (Current Net Income)"
    | "Share Capital" | "Retained Earnings"
    | string;

export type BalanceSheetComparisonStatus = "disabled" | "available" | "unavailable";

export interface FinancialAccount {
    id: string;
    coaId?: number;
    account: string;
    code: string;
    currentPeriod: number;
    currentBalanceStatus?: "reported" | "zero";
    priorPeriod: number | null;
    comparisonBalanceStatus?: "reported" | "zero" | "unavailable" | "disabled";
    variance: number | null;
    variancePercentage: number | null;
    type: AccountType;
    group: AccountGroup;
    isParent?: boolean;
    childAccounts?: FinancialAccount[];
}

export interface ValidationStatus {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    variance: number;
    isBalanced: boolean;
}

export interface RatioValue {
    current: number | null;
    prior: number | null;
    variance: number | null;
}

export interface KeyRatios {
    currentRatio: RatioValue;
    quickRatio: RatioValue;
    debtToEquity: RatioValue;
    debtRatio: RatioValue;
}
