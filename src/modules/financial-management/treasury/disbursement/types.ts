export interface PayableLine {
    id?: number;
    isMemo?: boolean;
    memoId?: number;
    memoType?: number;
    memoNumber?: string;
    /** UI-only supplier snapshot used to flag memo lines after a payee change. */
    memoSupplierId?: number;
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
    bankName?: string;
    bankAccountNumber?: string;
    checkNo: string;
    date: string;
    amount: number;
    remarks?: string;
    releasedDate?: string;
    releasedBy?: string | number;
}

export type DisbursementPaymentState =
    | "UNPAID"
    | "ALLOCATED"
    | "PARTIALLY_RELEASED"
    | "RELEASED";

export interface Disbursement {
    id: number;
    docNo: string;
    payeeId?: number;
    transactionTypeId?: number;
    transactionTypeName?: string;
    payeeName?: string;
    remarks?: string;
    totalAmount: number;
    paidAmount: number;
    paymentState: DisbursementPaymentState;

    // Financial Header Aggregates
    totalDebit?: number;
    totalCredit?: number;
    balance?: number;

    encoderName?: string;
    submittedByName?: string;
    approverName?: string;
    releasedByName?: string;
    postedByName?: string;
    encoderId?: number;
    approverId?: number;
    postedById?: number;
    submittedById?: number;
    releasedById?: number;

    isPosted: number;
    transactionDate?: string;
    dateCreated?: string;
    dateSubmitted?: string;
    dateApproved?: string;
    dateReleased?: string;
    datePosted?: string;
    
    divisionId?: number;
    departmentId?: number;
    divisionName?: string;
    departmentName?: string;
    status: string;
    supportingDocumentsUrl?: string;

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
    departmentId?: number;
    fundSourceId?: number;
    supportingDocumentsUrl?: string;

    payables: PayableLine[];
    payments?: PaymentLine[];
}

export interface PaymentAllocationPayload {
    saveScope: "RELEASING_PAYMENT";
    payments: PaymentLine[];
}

export interface DisbursementSubmitResult {
    success: boolean;
    code?: string;
    message?: string;
    nextDocNo?: string;
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
    supplier_type: "TRADE" | "NON-TRADE";
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
    accountType?: number | null;
    isPayment?: boolean;
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
    supplier_id?: number;
    type: number;
    memo_type_name: string;
    date: string;
    amount: number;
    applied_amount?: number;
    remaining_amount?: number;
    is_locked?: boolean;
    locking_tr_doc_no?: string | null;
    locking_tr_status?: string | null;
    locking_tr_count?: number;
    reason: string | null;
    coa_id: number;
    account_title: string;
}

export interface DepartmentExpense {
    departmentId: number;
    departmentName: string;
    totalExpense: number;
}

export interface DivisionExpense {
    divisionId: number;
    divisionName: string;
    totalExpense: number;
    departments?: DepartmentExpense[];
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
    supportingDocumentsUrl?: string;
    remarks?: string;
}

export interface DisbursementDashboardData {
    totalDisbursed: number;
    totalPaid: number;
    totalUnpaidPayables: number;
    divisionExpenses: DivisionExpense[];
    payableDivisionExpenses?: DivisionExpense[];
    paymentCoaExpenses: CoaExpense[];
    payableCoaExpenses: CoaExpense[];
    vouchers: VoucherSummary[];
    activeEncoderIds?: number[];
}

export interface DashboardFilters {
    startDate?: string;
    endDate?: string;
    status?: string; // Comma-separated list e.g., "Draft,Submitted"
    payeeId?: string; // Comma-separated list e.g., "1,2"
    transactionType?: string; // Comma-separated list e.g., "1,2"
    encoderId?: string; // Comma-separated list e.g., "1,2"
    coaId?: string; // Comma-separated list e.g., "1,2"
    minAmount?: number | "";
    maxAmount?: number | "";
    remarks?: string;
    divisionId?: string; // 🚀 NEW
}

export interface CoaExpense {
    coaId: number;
    accountTitle: string;
    totalExpense: number;
}
