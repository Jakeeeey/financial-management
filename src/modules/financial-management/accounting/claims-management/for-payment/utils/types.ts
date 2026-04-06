// src/modules/financial-management/claims-management/for-payment/utils/types.ts
export type TransmittalRow = {
    id: number;
    transmittal_no?: string | null;
    status?: string | null;
    created_at?: string | null;
    total_amount?: string | number | null;

    supplier_id?: number | null;
    supplier_name?: string | null;

    supplier_representative_id?: number | null;
    representative_name?: string | null;

    created_by_name?: string | null;
};

export type TransmittalDetailRow = {
    id: number;
    claims_transmittal_id: number;

    customer_memo_id: number;
    memo_number?: string | null;

    // ✅ NEW columns for For Payment
    received_at?: string | null;          // Date Received
    customer_name?: string | null;        // Customer Name
    gl_code?: string | null;              // Chart of Accounts
    account_title?: string | null;        // Chart of Accounts
    remarks?: string | null;              // Remarks (detail remarks OR memo reason)
    reason?: string | null;               // kept for fallback/debug

    amount?: string | number | null;      // Total
};