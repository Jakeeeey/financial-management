export interface CheckDetailDto {
    date: string;
    chequeDate: string | null;
    docNo: string;
    bankName: string;
    checkNo: string;
    customerName: string | null;
    amount: number;
}

export interface VarianceDetailDto {
    docNo?: string;
    type: string;
    customerName?: string | null;
    invoiceNo?: string | null;
    accountTitle: string;
    remarks: string;
    amount: number;
}

// 🚀 NEW: Hierarchical Invoice Structure
export interface SettledInvoiceDto {
    invoiceNo: string;
    customerName: string;
    invoiceTotal: number; // Existing net-of-discount document value.
    actualInvoiceTotal: number; // Original gross invoice amount before discounts.
    remainingBalance: number; // Persisted AR balance after settlement applications.
    grossAmount: number;
    memoAmount: number;
    returnAmount: number;
    netAmount: number;
}

export interface PouchReportDto {
    id: number;
    docNo: string; date: string; isPosted: boolean;
    totalCash: number; totalCheck: number;
    shortage: number; overage: number;
    totalInvoices: number; totalMemos: number; totalReturns: number;
    invoiceNetTotal: number;
    checks: CheckDetailDto[]; variances: VarianceDetailDto[]; invoices: SettledInvoiceDto[];
}

export interface CollectionReportSalesman {
    id: number;
    salesmanName: string;
}

export interface CollectionSummaryReportDto {
    startDate: string; endDate: string; generatedBy: string;
    globalCash: number; globalChecks: number;
    globalShortages: number; globalOverages: number; globalNetInvoice: number;
    pouches: PouchReportDto[];
}

export interface PaymentHistory {
    date: string;
    type: string;
    reference: string;
    amount: number;
}

export interface SettlementAllocation {
    invoiceId: number;
    invoiceNo: string;
    customerCode?: string;
    customerName: string;
    transactionDate: string;
    dueDate: string;
    agingDays: number;

    // FORENSIC DATA
    originalAmount: number;
    totalPayments: number;
    totalMemos: number;
    totalReturns: number;
    remainingBalance: number;
    maxSettleableAmount?: number;

    // HISTORY POPUP
    history?: PaymentHistory[];

    // CURRENT SESSION DATA
    amountApplied: number;
    allocationType: string;
    sourceTempId: string;
}

