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
    payeeId?: number;
    transactionTypeName?: string;
    payeeName?: string;
    remarks?: string;
    totalAmount: number;
    paidAmount: number;

    // 🚀 NEW: Financial Header Aggregates
    totalDebit?: number;
    totalCredit?: number;
    balance?: number;

    encoderName?: string;
    approverName?: string;
    postedByName?: string;
    encoderId?: number;
    approverId?: number;
    postedById?: number;

    isPosted: number;
    transactionDate?: string;
    dateCreated?: string;
    dateApproved?: string;
    datePosted?: string;
    divisionId?: number;
    departmentId?: number;
    divisionName?: string;
    departmentName?: string;
    status: string;

    payables: PayableLine[];
    payments: PaymentLine[];
}

export interface DisbursementPayload {
    docNo?: string;
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

export interface DivisionDto {
    divisionId: number;
    divisionName: string;
}

export interface DepartmentDto {
    departmentId: number;
    departmentName: string;
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
    isPayment?: boolean;
    isPaymentDuplicate?: boolean;
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
    type: string;
}

export interface MemoDto {
    id: number;
    memo_number: string;
    type: number;
    memo_type_name: string;
    date: string;
    amount: number;
    reason: string | null;
    coa_id: number;
    account_title: string;
}

// Add to your existing types.ts in the disbursement module
export interface DivisionExpense {
    divisionId: number;
    divisionName: string;
    totalExpense: number;
}

export interface VoucherSummary {
    id: number;
    docNo: string;
    transactionDate: string;
    status: string;
    payeeName: string;
    totalAmount: number;
    paidAmount: number;
    checkNumbers: string;
    bankNames: string;
    expenseAccountsHit: string;
}

export interface DisbursementDashboardData {
    totalDisbursed: number;
    totalPaid: number;
    totalUnpaidPayables: number;
    divisionExpenses: DivisionExpense[];
    coaExpenses: CoaExpense[]; // 🚀 NEW
    vouchers: VoucherSummary[];

}

export interface DashboardFilters {
    startDate?: string;
    endDate?: string;
    status?: string;
    payeeId?: number | "";
    transactionType?: number | ""; // 🚀 NEW
    encoderId?: number | "";
    coaId?: number | "";
    amount?: number | "";
}

export interface CoaExpense {
    coaId: number;
    accountTitle: string;
    totalExpense: number;
}