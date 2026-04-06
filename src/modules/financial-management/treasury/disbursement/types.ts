export interface PayableLine {
    id?: number;
    divisionId?: number;
    divisionName?: string;
    referenceNo: string;
    date: string;
    coaId?: number;
    accountTitle?: string;
    amount: number;
    remarks?: string;
}

export interface PaymentLine {
    id?: number;
    coaId?: number;
    accountTitle?: string;
    bankId?: number;
    checkNo: string;
    date: string;
    amount: number;
    remarks?: string;
}

export interface Disbursement {
    id: number;
    docNo: string;
    payeeId?: number; // 🚀 Added for Edit mode population
    transactionTypeName?: string;
    payeeName?: string;
    remarks?: string;
    totalAmount: number;
    paidAmount: number;

    encoderName?: string;
    approverName?: string;
    postedByName?: string;

    isPosted: number;
    transactionDate?: string;
    dateCreated?: string;
    dateApproved?: string;
    datePosted?: string;

    divisionName?: string;
    departmentName?: string;
    status: string;

    payables: PayableLine[];
    payments: PaymentLine[];
}

export interface DisbursementPayload {
    docNo?: string; // 🚀 Made optional so the backend can auto-generate
    transactionTypeId?: number;
    payeeId: number;
    remarks?: string;
    totalAmount: number;
    transactionDate?: string;
    divisionId?: number;
    departmentId?: number;
    fundSourceId?: number;
    supportingDocumentsUrl?: string;

    payables: PayableLine[];
    payments: PaymentLine[];
}

export interface SupplierDto {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string;
    isActive: boolean;
}

export interface PaginatedResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export interface COADto {
    coaId: number;
    glCode: string;
    accountTitle: string;
    isPayment?: boolean; // 🚀 Added to support the payments dropdown filter
    isPaymentDuplicate?: boolean; // 🚀 Added to support the payments dropdown filter
}
export interface BankAccountDto {
    bankId: number;
    bankName: string;
    accountNumber: string;
}
export interface UnpaidPoDto {
    uniqueKey: string;
    poId: number;
    poNo: string;
    receiptNo: string;
    date: string;
    amountDue: number;
    type: string; // 🚀 NEW
}