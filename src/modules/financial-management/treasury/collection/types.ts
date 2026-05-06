"use client";

// --- AUTH & USER ---
export interface CurrentUser {
    id: string;
    name: string;
    email: string;
}

// --- MASTER DATA ---
export interface Bank {
    id: number;
    bankName: string;
}

export interface COA {
    id?: number;
    coaId?: number;
    glCode: string;
    accountTitle: string;
    isPayment?: boolean | number;
    isPaymentDuplicate?: boolean;
}

export interface Salesman {
    id: number | string;
    salesmanCode: string;
    salesmanName: string;
}

export interface Denomination {
    id: number;
    amount: number; // Face value (1000, 500, etc.)
}

export interface PaymentMethod {
    methodId: number | string;
    methodName: string;
    coaId?: number | string;
}

export interface Customer {
    id: number | string;
    customerCode?: string;
    code?: string;
    customerName?: string;
    name?: string;
}

// --- CASHIERING / POUCH MODULE ---
export interface CollectionSummary {
    id: number;
    docNo: string;
    date: string;
    salesmanCode: string;
    salesmanName: string;
    amount: number;
    appliedAmount: number;
    status: string;
}

export interface CheckDetail {
    tempId: string;
    coaId: string;
    bankId: string;
    checkNo: string;
    amount: string;
    chequeDate: string;
    paymentMethodId?: string;
    customerId?: string;
    invoiceId?: string;
}

export interface CashBucketDto {
    amount?: number;
    paymentMethod?: string;
    balanceTypeId?: number;
    referenceNo?: string;
    bankName?: string;
    checkNo?: string;
    checkDate?: string;
    tempId?: string;
}

export interface CashieringRequestDto {
    id?: number;
    salesmanId: number | string;
    collectionDate: string;
    remarks: string;
    cashBuckets: CashBucketDto[];
    allocations: SettlementAllocation[];
}

// --- AR SETTLEMENT & FORENSICS ---
export interface PaymentHistory {
    date: string;
    type: string;
    reference: string;
    amount: number;
}

export interface UnpaidInvoice {
    id: number;
    invoiceId?: number; // Added for backwards compatibility in UI
    invoiceNo: string;
    customerName: string;
    transactionDate: string;
    dueDate: string;
    agingDays: number;

    // FORENSIC TOTALS
    originalAmount: number;
    totalPayments: number;
    totalMemos: number;
    totalReturns: number;
    remainingBalance: number;

    // AUDIT TRAIL
    history?: PaymentHistory[];
}

export interface SettlementAllocation {
    invoiceId: number;
    invoiceNo: string;
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

    // HISTORY POPUP
    history?: PaymentHistory[];

    // CURRENT SESSION DATA
    amountApplied: number;
    allocationType: string;
    sourceTempId: string;
}

// --- STATE & PAYLOADS ---
export interface CashieringState {
    isSheetOpen: boolean;
    setIsSheetOpen: (open: boolean) => void;
    isLoading: boolean;
    isSheetLoading: boolean;
    isSubmitting: boolean;
    editingId: number | null;
    masterList: CollectionSummary[];
    salesmen: Salesman[];
    banks: Bank[];
    coas: COA[];
    paymentMethods: PaymentMethod[]; // 🚀 Added
    customers: Customer[];           // 🚀 Added
    customerInvoices: Record<string, UnpaidInvoice[]>; // 🚀 Added
    routeInvoices: UnpaidInvoice[];  // 🚀 Added
    salesmanId: string;
    setSalesmanId: (id: string) => void;
    collectionDate: string;
    setCollectionDate: (date: string) => void;
    remarks: string;
    setRemarks: (remarks: string) => void;
    denominations: Record<number, number>;
    handleDenomChange: (id: number, qty: string) => void;
    denominationMaster: Denomination[];
    checks: CheckDetail[];
    addCheck: () => void;
    updateCheck: (index: number, field: keyof CheckDetail, value: string) => void;
    removeCheck: (index: number) => void;
    handlePaymentMethodSelect: (index: number, methodId: string) => void; // 🚀 Added
    handleCustomerSelect: (index: number, customerId: string) => void;    // 🚀 Added
    handleInvoiceSelect: (index: number, invoiceId: string) => void;      // 🚀 Added
    totalCash: number;
    totalChecks: number;
    grandTotal: number;
    handleSubmit: () => Promise<void>;
    loadPouchForEdit: (id: number) => Promise<void>;
    resetForm: () => void;
}

export interface NewAdjustmentDto {
    findingId?: number;
    amount: number;
    balanceTypeId: number;
    remarks: string;
    invoiceId: number | null;
    tempId: string;
}

export interface NewEwtDto {
    amount: number;
    referenceNo: string;
    tempId: string;
}

export interface SettlementPayload {
    newAdjustments: NewAdjustmentDto[];
    newEwts: NewEwtDto[];
    allocations: SettlementAllocation[];
}