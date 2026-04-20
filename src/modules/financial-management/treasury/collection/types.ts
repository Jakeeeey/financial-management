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
}

// 🚀 NEW: Strict interface to replace the 'any' in CashieringRequestDto
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
    cashBuckets: CashBucketDto[]; // 🚀 FIX: Typed array instead of any[]
    allocations: SettlementAllocation[]; // The "Cart" of invoices
}

// --- AR SETTLEMENT & FORENSICS ---
export interface PaymentHistory {
    date: string;
    type: string;      // "CASH/CHECK", "MEMO", "RETURN"
    reference: string;
    amount: number;
}

export interface UnpaidInvoice {
    id: number;
    invoiceNo: string;
    customerName: string;
    transactionDate: string;
    dueDate: string;
    agingDays: number;

    // 🚀 FORENSIC TOTALS
    originalAmount: number;
    totalPayments: number;
    totalMemos: number;
    totalReturns: number;
    remainingBalance: number;

    // 🚀 AUDIT TRAIL
    history?: PaymentHistory[];
}

export interface SettlementAllocation {
    invoiceId: number;
    invoiceNo: string;
    customerName: string;
    transactionDate: string;
    dueDate: string;
    agingDays: number;

    // 🚀 FORENSIC DATA (Populated when loading existing pouches)
    originalAmount: number;
    totalPayments: number;
    totalMemos: number;
    totalReturns: number;
    remainingBalance: number;

    // 🚀 HISTORY POPUP
    history?: PaymentHistory[];

    // CURRENT SESSION DATA
    amountApplied: number;
    allocationType: string; // "CASH", "CHECK", "MEMO", "RETURN"
    sourceTempId: string;   // Maps to the specific Check/Memo/Return ID
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
    totalCash: number;
    totalChecks: number;
    grandTotal: number;
    handleSubmit: () => Promise<void>;
    loadPouchForEdit: (id: number) => Promise<void>;
    resetForm: () => void;
}

// 🚀 NEW: Strict interfaces to replace the 'any's in SettlementPayload
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

// --- SETTLEMENT PAYLOAD ---
export interface SettlementPayload {
    newAdjustments: NewAdjustmentDto[]; // 🚀 FIX: Typed array instead of any[]
    newEwts: NewEwtDto[];               // 🚀 FIX: Typed array instead of any[]
    allocations: SettlementAllocation[];
}